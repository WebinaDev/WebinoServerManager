"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

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
import { api } from "@/lib/api"
import { useLocale } from "@/hooks/useLocale"
import { toast, toastMutationError } from "@/lib/toast"

type CheckRow = {
  id: number
  name: string
  target: string
  type: string
  interval_minutes: number
  enabled: boolean
  last_status?: string | null
  last_latency_ms?: number | null
  last_checked_at?: string | null
}

type ResultRow = {
  status: string
  latency_ms: number | null
  checked_at: string
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 120
  const h = 32
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-28 text-primary" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  )
}

function statusClass(status?: string | null) {
  if (status === "up") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
  if (status === "down") return "bg-destructive/15 text-destructive"
  return "bg-muted text-muted-foreground"
}

function UptimeSparkline({ checkId }: { checkId: number }) {
  const { data } = useQuery({
    queryKey: ["uptime-results", checkId],
    queryFn: () =>
      api<{ results: ResultRow[] }>(`/api/v1/monitoring/uptime/${checkId}/results`),
  })
  const latencies = (data?.results ?? [])
    .slice()
    .reverse()
    .map((r) => r.latency_ms ?? 0)
  return <Sparkline values={latencies} />
}

export default function UptimePage() {
  const { t } = useTranslation(["monitoring", "common", "dns"])
  const { formatDateTime } = useLocale()
  const qc = useQueryClient()
  const [editingCheck, setEditingCheck] = useState<CheckRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["uptime-checks"],
    queryFn: () => api<{ checks: CheckRow[] }>("/api/v1/monitoring/uptime"),
    refetchInterval: 60_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["uptime-checks"] })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/monitoring/uptime", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("monitoring:check_created", { defaultValue: "Uptime check created" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/api/v1/monitoring/uptime/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      toast.success(t("monitoring:check_updated", { defaultValue: "Uptime check updated" }))
      setEditingCheck(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api(`/api/v1/monitoring/uptime/${id}`, { method: "PATCH", json: { enabled } }),
    onSuccess: () => {
      toast.success(t("monitoring:check_updated", { defaultValue: "Uptime check updated" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/monitoring/uptime/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("monitoring:check_deleted", { defaultValue: "Uptime check deleted" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const checks = data?.checks ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("monitoring:uptime_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 md:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                name: String(fd.get("name")),
                target: String(fd.get("target")),
                type: String(fd.get("type")),
                interval_minutes: Number(fd.get("interval_minutes") || 5),
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="check-name">{t("monitoring:check_name")}</Label>
              <Input id="check-name" name="name" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="check-target">{t("monitoring:check_target")}</Label>
              <Input id="check-target" name="target" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="check-type">{t("monitoring:check_type")}</Label>
              <select
                id="check-type"
                name="type"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                defaultValue="http"
              >
                <option value="http">HTTP</option>
                <option value="tcp">TCP</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="check-interval">{t("monitoring:check_interval")}</Label>
              <Input
                id="check-interval"
                name="interval_minutes"
                type="number"
                min={1}
                defaultValue={5}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-5">
              <Button type="submit" disabled={create.isPending}>
                {t("monitoring:add_check")}
              </Button>
            </div>
          </form>

          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {checks.length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">
                  {t("monitoring:uptime_empty")}
                </li>
              ) : (
                checks.map((check) => (
                  <li
                    key={check.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{check.name}</p>
                      <p className="text-muted-foreground text-xs" dir="ltr">
                        {check.type.toUpperCase()} · {check.target}
                      </p>
                      {check.last_checked_at ? (
                        <p className="text-muted-foreground text-xs">
                          {t("monitoring:last_checked")}: {formatDateTime(check.last_checked_at)}
                          {check.last_latency_ms != null
                            ? ` · ${check.last_latency_ms}ms`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(check.last_status)}`}
                      >
                        {check.last_status ?? t("monitoring:unknown")}
                      </span>
                      <UptimeSparkline checkId={check.id} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCheck(check)}
                      >
                        {t("dns:edit", { defaultValue: "Edit" })}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggle.mutate({ id: check.id, enabled: !check.enabled })
                        }
                      >
                        {check.enabled ? t("monitoring:enabled") : t("monitoring:disabled")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("monitoring:delete_check_confirm"))) {
                            remove.mutate(check.id)
                          }
                        }}
                      >
                        {t("monitoring:delete")}
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingCheck !== null} onOpenChange={(open) => !open && setEditingCheck(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("monitoring:edit_check", { defaultValue: "Edit uptime check" })}
            </DialogTitle>
          </DialogHeader>
          {editingCheck ? (
            <form
              key={editingCheck.id}
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                update.mutate({
                  id: editingCheck.id,
                  body: {
                    name: String(fd.get("name")),
                    target: String(fd.get("target")),
                    type: String(fd.get("type")),
                    interval_minutes: Number(fd.get("interval_minutes") || 5),
                    enabled: fd.get("enabled") === "on",
                  },
                })
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-check-name">{t("monitoring:check_name")}</Label>
                <Input
                  id="edit-check-name"
                  name="name"
                  required
                  defaultValue={editingCheck.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-check-target">{t("monitoring:check_target")}</Label>
                <Input
                  id="edit-check-target"
                  name="target"
                  required
                  dir="ltr"
                  defaultValue={editingCheck.target}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-check-type">{t("monitoring:check_type")}</Label>
                <select
                  id="edit-check-type"
                  name="type"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue={editingCheck.type}
                >
                  <option value="http">HTTP</option>
                  <option value="tcp">TCP</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-check-interval">{t("monitoring:check_interval")}</Label>
                <Input
                  id="edit-check-interval"
                  name="interval_minutes"
                  type="number"
                  min={1}
                  dir="ltr"
                  defaultValue={editingCheck.interval_minutes}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="enabled"
                  className="rounded"
                  defaultChecked={editingCheck.enabled}
                />
                {t("monitoring:enabled")}
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingCheck(null)}>
                  {t("common:cancel")}
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {t("common:save")}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
