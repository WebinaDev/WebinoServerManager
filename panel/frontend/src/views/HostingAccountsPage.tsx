"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type AccountRow = {
  id: number
  username: string
  primary_domain: string | null
  status: string
  disk_used_mb: number
  inodes_used: number
  plan?: { name: string; disk_mb: number; inodes: number }
}

type PlanOption = { id: number; name: string }

type QuotaAlertRow = {
  id: number
  resource: string
  threshold_percent: number
  enabled: boolean
  escalation_minutes: number
  escalation_channel: string
}

const QUOTA_RESOURCES = [
  "disk",
  "inodes",
  "domains",
  "subdomains",
  "databases",
  "mailboxes",
  "ftp",
  "cron",
  "apps",
]

function QuotaAlertsPanel({ accountId, username }: { accountId: number; username: string }) {
  const { t } = useTranslation(["hosting", "common"])
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["quota-alerts", accountId],
    queryFn: () =>
      api<{ alerts: QuotaAlertRow[] }>(`/api/v1/hosting/accounts/${accountId}/quota-alerts`),
  })

  const save = useMutation({
    mutationFn: (body: {
      resource: string
      threshold_percent: number
      escalation_minutes: number
      escalation_channel: string
    }) =>
      api(`/api/v1/hosting/accounts/${accountId}/quota-alerts`, {
        method: "POST",
        json: body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quota-alerts", accountId] }),
  })

  const remove = useMutation({
    mutationFn: (alertId: number) =>
      api(`/api/v1/hosting/accounts/${accountId}/quota-alerts/${alertId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quota-alerts", accountId] }),
  })

  return (
    <div className="bg-muted/40 space-y-3 rounded-md border p-3">
      <p className="font-medium">{t("hosting:quota_alerts_title", { username })}</p>
      {isLoading ? (
        <p className="text-muted-foreground text-xs">{t("common:loading")}</p>
      ) : (
        <ul className="divide-y rounded-md border bg-background">
          {(data?.alerts ?? []).length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-xs">{t("hosting:quota_alerts_empty")}</li>
          ) : (
            (data?.alerts ?? []).map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <span dir="ltr">
                  {alert.resource} ≥ {alert.threshold_percent}% · {alert.escalation_channel} ·{" "}
                  {alert.escalation_minutes}m
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => remove.mutate(alert.id)}
                >
                  {t("common:delete")}
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
      <form
        className="grid gap-2 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          save.mutate({
            resource: String(fd.get("resource") ?? "disk"),
            threshold_percent: Number(fd.get("threshold_percent") ?? 80),
            escalation_minutes: Number(fd.get("escalation_minutes") ?? 60),
            escalation_channel: String(fd.get("escalation_channel") ?? "email"),
          })
          e.currentTarget.reset()
        }}
      >
        <select
          name="resource"
          className="border-input bg-background flex h-9 rounded-md border px-2 text-sm"
          defaultValue="disk"
        >
          {QUOTA_RESOURCES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Input
          name="threshold_percent"
          type="number"
          min={1}
          max={100}
          defaultValue={80}
          placeholder="%"
          dir="ltr"
        />
        <Input
          name="escalation_minutes"
          type="number"
          min={5}
          defaultValue={60}
          dir="ltr"
        />
        <select
          name="escalation_channel"
          className="border-input bg-background flex h-9 rounded-md border px-2 text-sm"
          defaultValue="email"
        >
          <option value="email">email</option>
          <option value="telegram">telegram</option>
          <option value="slack">slack</option>
          <option value="webhook">webhook</option>
          <option value="all">all</option>
        </select>
        <div className="md:col-span-4">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {t("hosting:quota_alert_add")}
          </Button>
        </div>
      </form>
    </div>
  )
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function HostingAccountsPage() {
  const { t } = useTranslation(["hosting", "common"])
  const qc = useQueryClient()
  const [username, setUsername] = useState("")
  const [planId, setPlanId] = useState("")
  const [domain, setDomain] = useState("")
  const [alertsAccountId, setAlertsAccountId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["hosting-accounts"],
    queryFn: () => api<{ accounts: AccountRow[] }>("/api/v1/hosting/accounts"),
  })

  const { data: plansData } = useQuery({
    queryKey: ["hosting-plans"],
    queryFn: () => api<{ plans: PlanOption[] }>("/api/v1/hosting/plans"),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hosting-accounts"] })

  const create = useMutation({
    mutationFn: () =>
      api("/api/v1/hosting/accounts", {
        method: "POST",
        json: {
          username,
          plan_id: Number(planId),
          primary_domain: domain || null,
        },
      }),
    onSuccess: () => {
      invalidate()
      setUsername("")
      setDomain("")
    },
  })

  const suspend = useMutation({
    mutationFn: (id: number) => api(`/api/v1/hosting/accounts/${id}/suspend`, { method: "POST", json: {} }),
    onSuccess: invalidate,
  })

  const unsuspend = useMutation({
    mutationFn: (id: number) => api(`/api/v1/hosting/accounts/${id}/unsuspend`, { method: "POST" }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/hosting/accounts/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("hosting:accounts_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>{t("hosting:field_username")}</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("hosting:field_plan")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                <option value="">{t("hosting:select_plan")}</option>
                {(plansData?.plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("hosting:field_domain")}</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !username || !planId}
          >
            {t("hosting:create_account")}
          </Button>

          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.accounts ?? []).map((a) => (
                <li key={a.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{a.username}</div>
                      <div className="text-muted-foreground">
                        {a.plan?.name ?? t("common:em_dash")} ·{" "}
                        <span className={a.status === "suspended" ? "text-destructive" : ""}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {a.status === "suspended" ? (
                        <Button size="sm" variant="outline" onClick={() => unsuspend.mutate(a.id)}>
                          {t("hosting:unsuspend")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (window.confirm(t("hosting:suspend_confirm"))) suspend.mutate(a.id)
                          }}
                        >
                          {t("hosting:suspend")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAlertsAccountId((cur) => (cur === a.id ? null : a.id))
                        }
                      >
                        {t("hosting:quota_alerts")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (window.confirm(t("hosting:delete_account_confirm"))) remove.mutate(a.id)
                        }}
                      >
                        {t("common:delete")}
                      </Button>
                    </div>
                  </div>
                  {alertsAccountId === a.id && (
                    <QuotaAlertsPanel accountId={a.id} username={a.username} />
                  )}
                  {a.plan && (
                    <div className="grid gap-2 md:grid-cols-2">
                      <UsageBar
                        used={a.disk_used_mb}
                        limit={a.plan.disk_mb}
                        label={t("hosting:usage_disk")}
                      />
                      <UsageBar
                        used={a.inodes_used}
                        limit={a.plan.inodes}
                        label={t("hosting:usage_inodes")}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
