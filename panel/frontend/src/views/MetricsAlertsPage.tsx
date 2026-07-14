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
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type AlertRow = {
  id: number
  metric: string
  comparison: string
  threshold: number
  enabled: boolean
  cooldown_minutes: number
}

function UsageBar({ label, percent }: { label: string; percent?: number }) {
  const pct = Math.min(100, Math.max(0, percent ?? 0))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono" dir="ltr">
          {percent != null ? `${pct.toFixed(1)}%` : "—"}
        </span>
      </div>
      <div className="bg-muted h-2 rounded-full overflow-hidden">
        <div
          className="bg-primary h-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 200
  const h = 40
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-xs text-primary" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  )
}

export default function MetricsAlertsPage() {
  const { t } = useTranslation(["metrics", "common", "dns"])
  const qc = useQueryClient()
  const [editingAlert, setEditingAlert] = useState<AlertRow | null>(null)

  const { data: current } = useQuery({
    queryKey: ["metrics-current"],
    queryFn: () =>
      api<{
        sample: { cpu_percent: number; mem_percent: number; disk_percent: number } | null
        current: { cpu_percent: number; mem_percent: number; disk_percent: number } | null
      }>("/api/v1/metrics/current"),
    refetchInterval: 30_000,
  })

  const { data: history } = useQuery({
    queryKey: ["metrics-history"],
    queryFn: () =>
      api<{
        samples: { cpu_percent: number; mem_percent: number; disk_percent: number }[]
      }>("/api/v1/metrics/history?range=1h"),
  })

  const { data: alertsData } = useQuery({
    queryKey: ["metrics-alerts"],
    queryFn: () => api<{ alerts: AlertRow[] }>("/api/v1/metrics/alerts"),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["metrics-alerts"] })

  const create = useMutation({
    mutationFn: (body: {
      metric: string
      comparison: string
      threshold: number
      cooldown_minutes: number
    }) => api("/api/v1/metrics/alerts", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("metrics:alert_created", { defaultValue: "Alert created" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/api/v1/metrics/alerts/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      toast.success(t("metrics:alert_updated", { defaultValue: "Alert updated" }))
      setEditingAlert(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api(`/api/v1/metrics/alerts/${id}`, { method: "PATCH", json: { enabled } }),
    onSuccess: () => {
      toast.success(t("metrics:alert_updated", { defaultValue: "Alert updated" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/metrics/alerts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("metrics:alert_deleted", { defaultValue: "Alert deleted" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const live = current?.current ?? current?.sample
  const cpuHistory = (history?.samples ?? []).map((s) => s.cpu_percent)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("metrics:current_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageBar label={t("metrics:cpu")} percent={live?.cpu_percent} />
          <UsageBar label={t("metrics:mem")} percent={live?.mem_percent} />
          <UsageBar label={t("metrics:disk")} percent={live?.disk_percent} />
          <Sparkline values={cpuHistory} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("metrics:alerts_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate({
                  metric: String(fd.get("metric")),
                  comparison: String(fd.get("comparison")),
                  threshold: Number(fd.get("threshold")),
                  cooldown_minutes: Number(fd.get("cooldown_minutes") || 60),
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="metric">{t("metrics:metric")}</Label>
                <select
                  id="metric"
                  name="metric"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue="cpu"
                >
                  <option value="cpu">{t("metrics:cpu")}</option>
                  <option value="mem">{t("metrics:mem")}</option>
                  <option value="disk">{t("metrics:disk")}</option>
                  <option value="load">{t("metrics:load")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="comparison">{t("metrics:comparison")}</Label>
                <select
                  id="comparison"
                  name="comparison"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue="gt"
                >
                  <option value="gt">{t("metrics:gt")}</option>
                  <option value="lt">{t("metrics:lt")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">{t("metrics:threshold")}</Label>
                <Input id="threshold" name="threshold" type="number" step="0.1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cooldown_minutes">{t("metrics:cooldown")}</Label>
                <Input id="cooldown_minutes" name="cooldown_minutes" type="number" defaultValue={60} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={create.isPending}>
                  {t("metrics:add_alert")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>
          <ul className="divide-y rounded-md border">
            {(alertsData?.alerts ?? []).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {a.metric} {a.comparison} {a.threshold}
                </span>
                <RequireRouteWrite>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAlert(a)}
                    >
                      {t("dns:edit", { defaultValue: "Edit" })}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggle.mutate({ id: a.id, enabled: !a.enabled })}
                    >
                      {a.enabled ? t("metrics:enabled") : t("metrics:disabled")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove.mutate(a.id)}
                    >
                      {t("metrics:delete")}
                    </Button>
                  </div>
                </RequireRouteWrite>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={editingAlert !== null} onOpenChange={(open) => !open && setEditingAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("metrics:edit_alert", { defaultValue: "Edit alert" })}</DialogTitle>
          </DialogHeader>
          {editingAlert ? (
            <form
              key={editingAlert.id}
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                update.mutate({
                  id: editingAlert.id,
                  body: {
                    metric: String(fd.get("metric")),
                    comparison: String(fd.get("comparison")),
                    threshold: Number(fd.get("threshold")),
                    cooldown_minutes: Number(fd.get("cooldown_minutes") || 60),
                    enabled: fd.get("enabled") === "on",
                  },
                })
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-metric">{t("metrics:metric")}</Label>
                <select
                  id="edit-metric"
                  name="metric"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue={editingAlert.metric}
                >
                  <option value="cpu">{t("metrics:cpu")}</option>
                  <option value="mem">{t("metrics:mem")}</option>
                  <option value="disk">{t("metrics:disk")}</option>
                  <option value="load">{t("metrics:load")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-comparison">{t("metrics:comparison")}</Label>
                <select
                  id="edit-comparison"
                  name="comparison"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue={editingAlert.comparison}
                >
                  <option value="gt">{t("metrics:gt")}</option>
                  <option value="lt">{t("metrics:lt")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-threshold">{t("metrics:threshold")}</Label>
                <Input
                  id="edit-threshold"
                  name="threshold"
                  type="number"
                  step="0.1"
                  required
                  defaultValue={editingAlert.threshold}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cooldown">{t("metrics:cooldown")}</Label>
                <Input
                  id="edit-cooldown"
                  name="cooldown_minutes"
                  type="number"
                  defaultValue={editingAlert.cooldown_minutes}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="enabled"
                  className="rounded"
                  defaultChecked={editingAlert.enabled}
                />
                {t("metrics:enabled")}
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingAlert(null)}>
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
