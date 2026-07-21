"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type AccountRow = {
  id: number
  username: string
  primary_domain: string | null
  plan_id?: number
  user_id?: number | null
  status: string
  disk_used_mb: number
  inodes_used: number
  bandwidth_used_mb?: number
  plan?: { name: string; disk_mb: number; inodes: number; bandwidth_mb?: number }
  owner?: { id: number; name: string; email: string | null } | null
}

type PlanOption = { id: number; name: string }
type UserOption = { id: number; name: string; username: string }

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
] as const

function quotaResourceLabel(
  t: (key: string) => string,
  resource: string,
): string {
  const key = `quota_resource_${resource}`
  try {
    return t(key)
  } catch {
    return resource
  }
}

function QuotaAlertsPanel({ accountId, username }: { accountId: number; username: string }) {
  const t = useTranslations("hosting")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [editingAlert, setEditingAlert] = useState<QuotaAlertRow | null>(null)
  const [editForm, setEditForm] = useState({
    threshold_percent: 80,
    escalation_minutes: 60,
    escalation_channel: "email",
    enabled: true,
  })

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
    onSuccess: () => {
      toast.success(t("quota_alert_saved"))
      qc.invalidateQueries({ queryKey: ["quota-alerts", accountId] })
    },
    onError: toastMutationError,
  })

  const updateAlert = useMutation({
    mutationFn: (body: {
      alertId: number
      threshold_percent: number
      escalation_minutes: number
      escalation_channel: string
      enabled: boolean
    }) =>
      api(`/api/v1/hosting/accounts/${accountId}/quota-alerts/${body.alertId}`, {
        method: "PATCH",
        json: {
          threshold_percent: body.threshold_percent,
          escalation_minutes: body.escalation_minutes,
          escalation_channel: body.escalation_channel,
          enabled: body.enabled,
        },
      }),
    onSuccess: () => {
      toast.success(t("quota_alert_saved"))
      setEditingAlert(null)
      qc.invalidateQueries({ queryKey: ["quota-alerts", accountId] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (alertId: number) =>
      api(`/api/v1/hosting/accounts/${accountId}/quota-alerts/${alertId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success(tCommon("delete"))
      qc.invalidateQueries({ queryKey: ["quota-alerts", accountId] })
    },
    onError: toastMutationError,
  })

  return (
    <div className="bg-muted/40 space-y-3 rounded-md border p-3">
      <p className="font-medium">{t("quota_alerts_title", { username })}</p>
      {isLoading ? (
        <p className="text-muted-foreground text-xs">{tCommon("loading")}</p>
      ) : (
        <ul className="divide-y rounded-md border bg-background">
          {(data?.alerts ?? []).length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-xs">{t("quota_alerts_empty")}</li>
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
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingAlert(alert)
                      setEditForm({
                        threshold_percent: alert.threshold_percent,
                        escalation_minutes: alert.escalation_minutes,
                        escalation_channel: alert.escalation_channel,
                        enabled: alert.enabled,
                      })
                    }}
                  >
                    {tCommon("edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => remove.mutate(alert.id)}
                  >
                    {tCommon("delete")}
                  </Button>
                </div>
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
              {quotaResourceLabel(t, r)}
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
            {t("quota_alert_add")}
          </Button>
        </div>
      </form>

      <Dialog open={editingAlert !== null} onOpenChange={(open) => !open && setEditingAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit_quota_alert")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>{t("quota_threshold")}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={editForm.threshold_percent}
                onChange={(e) =>
                  setEditForm({ ...editForm, threshold_percent: Number(e.target.value) })
                }
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("quota_escalation_minutes")}</Label>
              <Input
                type="number"
                min={5}
                value={editForm.escalation_minutes}
                onChange={(e) =>
                  setEditForm({ ...editForm, escalation_minutes: Number(e.target.value) })
                }
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("quota_escalation_channel")}</Label>
              <select
                className="border-input bg-background flex h-9 w-full rounded-md border px-2 text-sm"
                value={editForm.escalation_channel}
                onChange={(e) =>
                  setEditForm({ ...editForm, escalation_channel: e.target.value })
                }
              >
                <option value="email">email</option>
                <option value="telegram">telegram</option>
                <option value="slack">slack</option>
                <option value="webhook">webhook</option>
                <option value="all">all</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editForm.enabled}
                onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
              />
              {t("enabled")}
            </label>
          </div>
          <Button
            type="button"
            disabled={!editingAlert || updateAlert.isPending}
            onClick={() => {
              if (!editingAlert) return
              updateAlert.mutate({
                alertId: editingAlert.id,
                ...editForm,
              })
            }}
          >
            {tCommon("save")}
          </Button>
        </DialogContent>
      </Dialog>
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
  const t = useTranslations("hosting")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [username, setUsername] = useState("")
  const [planId, setPlanId] = useState("")
  const [domain, setDomain] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [alertsAccountId, setAlertsAccountId] = useState<number | null>(null)
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null)
  const [editPlanId, setEditPlanId] = useState("")
  const [editDomain, setEditDomain] = useState("")
  const [editOwnerId, setEditOwnerId] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["hosting-accounts"],
    queryFn: () => api<{ accounts: AccountRow[] }>("/api/v1/hosting/accounts"),
  })

  const { data: plansData } = useQuery({
    queryKey: ["hosting-plans"],
    queryFn: () => api<{ plans: PlanOption[] }>("/api/v1/hosting/plans"),
  })

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: UserOption[] }>("/api/v1/users"),
  })

  const accounts = data?.accounts ?? []
  const alertsAccount = useMemo(
    () => accounts.find((a) => a.id === alertsAccountId) ?? null,
    [accounts, alertsAccountId],
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hosting-accounts"] })

  const create = useMutation({
    mutationFn: () =>
      api("/api/v1/hosting/accounts", {
        method: "POST",
        json: {
          username,
          plan_id: Number(planId),
          primary_domain: domain || null,
          user_id: ownerId ? Number(ownerId) : null,
        },
      }),
    onSuccess: () => {
      toast.success(t("create_account"))
      invalidate()
      setUsername("")
      setDomain("")
      setOwnerId("")
    },
    onError: toastMutationError,
  })

  const suspend = useMutation({
    mutationFn: (id: number) => api(`/api/v1/hosting/accounts/${id}/suspend`, { method: "POST", json: {} }),
    onSuccess: invalidate,
    onError: toastMutationError,
  })

  const unsuspend = useMutation({
    mutationFn: (id: number) => api(`/api/v1/hosting/accounts/${id}/unsuspend`, { method: "POST" }),
    onSuccess: invalidate,
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/hosting/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(tCommon("delete"))
      if (alertsAccountId) setAlertsAccountId(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const updateAccount = useMutation({
    mutationFn: ({
      id,
      plan_id,
      primary_domain,
      user_id,
    }: {
      id: number
      plan_id: number
      primary_domain: string | null
      user_id: number | null
    }) =>
      api(`/api/v1/hosting/accounts/${id}`, {
        method: "PATCH",
        json: { plan_id, primary_domain, user_id },
      }),
    onSuccess: () => {
      toast.success(t("account_saved"))
      setEditingAccount(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const columns: DataTableColumn<AccountRow>[] = [
    {
      id: "username",
      header: t("field_username"),
      sortValue: (row) => row.username,
      cell: (a) => (
        <div>
          <div className="font-medium">{a.username}</div>
          <div className="text-muted-foreground">
            {a.plan?.name ?? tCommon("em_dash")} ·{" "}
            <span className={a.status === "suspended" ? "text-destructive" : ""}>{a.status}</span>
          </div>
        </div>
      ),
    },
    {
      id: "usage",
      header: t("usage_disk"),
      cell: (a) =>
        a.plan ? (
          <div className="grid min-w-[200px] gap-2">
            <UsageBar
              used={a.disk_used_mb}
              limit={a.plan.disk_mb}
              label={t("usage_disk")}
            />
            <UsageBar
              used={a.inodes_used}
              limit={a.plan.inodes}
              label={t("usage_inodes")}
            />
            <UsageBar
              used={a.bandwidth_used_mb ?? 0}
              limit={a.plan.bandwidth_mb ?? 0}
              label={t("usage_bandwidth")}
            />
          </div>
        ) : (
          <span className="text-muted-foreground">{tCommon("em_dash")}</span>
        ),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: (a) => (
        <RequireRouteWrite>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingAccount(a)
                setEditPlanId(String(a.plan_id ?? ""))
                setEditDomain(a.primary_domain ?? "")
                setEditOwnerId(String(a.user_id ?? a.owner?.id ?? ""))
              }}
            >
              {tCommon("edit")}
            </Button>
            {a.status === "suspended" ? (
              <Button size="sm" variant="outline" onClick={() => unsuspend.mutate(a.id)}>
                {t("unsuspend")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (window.confirm(t("suspend_confirm"))) suspend.mutate(a.id)
                }}
              >
                {t("suspend")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAlertsAccountId((cur) => (cur === a.id ? null : a.id))}
            >
              {t("quota_alerts")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm(t("delete_account_confirm"))) remove.mutate(a.id)
              }}
            >
              {tCommon("delete")}
            </Button>
          </div>
        </RequireRouteWrite>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("accounts_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label>{t("field_username")}</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t("field_plan")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  <option value="">{t("select_plan")}</option>
                  {(plansData?.plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t("field_domain")}</Label>
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t("field_owner")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="">{t("select_owner")}</option>
                  {(usersData?.users ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !username || !planId}
            >
              {t("create_account")}
            </Button>
          </RequireRouteWrite>

          <DataTable
            columns={columns}
            data={accounts}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("search_accounts")}
            searchFilter={(row, q) =>
              row.username.toLowerCase().includes(q) ||
              (row.plan?.name ?? "").toLowerCase().includes(q) ||
              row.status.toLowerCase().includes(q)
            }
            emptyMessage={t("empty_accounts")}
          />

          {alertsAccount ? (
            <QuotaAlertsPanel accountId={alertsAccount.id} username={alertsAccount.username} />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editingAccount !== null} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit_account")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>{t("field_plan")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editPlanId}
                onChange={(e) => setEditPlanId(e.target.value)}
              >
                <option value="">{t("select_plan")}</option>
                {(plansData?.plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("field_domain")}</Label>
              <Input value={editDomain} onChange={(e) => setEditDomain(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("field_owner")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editOwnerId}
                onChange={(e) => setEditOwnerId(e.target.value)}
              >
                <option value="">{t("select_owner")}</option>
                {(usersData?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            type="button"
            disabled={!editingAccount || !editPlanId || updateAccount.isPending}
            onClick={() => {
              if (!editingAccount) return
              updateAccount.mutate({
                id: editingAccount.id,
                plan_id: Number(editPlanId),
                primary_domain: editDomain || null,
                user_id: editOwnerId ? Number(editOwnerId) : null,
              })
            }}
          >
            {tCommon("save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
