"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type SystemInfo = {
  hostname?: string
  kernel?: string
  os?: string
  uptime_seconds?: number
  load_average?: string
  load1?: number
  cpu_percent?: number
  mem_percent?: number
  mem_total_mb?: number
  mem_used_mb?: number
  disk_percent?: number
  disk_total?: string
  disk_used?: string
  memory?: string
  disk?: string
  collected_at?: string
}

type PlatformStatus = {
  ok?: boolean
  error?: string
  data?: Record<string, unknown> | string
  initialized?: boolean
  version?: string
  message?: string
  [key: string]: unknown
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
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 240
  const h = 48
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="text-primary w-full" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  )
}

function flattenPlatform(payload: PlatformStatus | undefined): { label: string; value: string }[] {
  if (!payload || typeof payload !== "object") return []
  const rows: { label: string; value: string }[] = []
  const skip = new Set(["data"])
  for (const [k, v] of Object.entries(payload)) {
    if (skip.has(k)) continue
    if (v == null) continue
    if (typeof v === "object") {
      rows.push({ label: k, value: JSON.stringify(v) })
    } else {
      rows.push({ label: k, value: String(v) })
    }
  }
  const data = payload.data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [k, v] of Object.entries(data)) {
      if (v == null) continue
      rows.push({
        label: k,
        value: typeof v === "object" ? JSON.stringify(v) : String(v),
      })
    }
  } else if (typeof data === "string" && data.trim()) {
    rows.push({ label: "data", value: data })
  }
  return rows
}

export default function SystemInfoPage() {
  const t = useTranslations("system")
  const tMetrics = useTranslations("metrics")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["system-info"],
    queryFn: () => api<{ info: SystemInfo }>("/api/v1/system/info"),
    refetchInterval: 30_000,
  })

  const { data: history } = useQuery({
    queryKey: ["metrics-history-system"],
    queryFn: () =>
      api<{ samples: { cpu_percent: number }[] }>("/api/v1/metrics/history?range=1h"),
    refetchInterval: 60_000,
  })

  const { data: platformData, isLoading: platformLoading } = useQuery({
    queryKey: ["platform-status"],
    queryFn: () => api<PlatformStatus>("/api/v1/platform/status"),
    refetchInterval: 60_000,
  })

  const initPlatform = useMutation({
    mutationFn: () => api<PlatformStatus>("/api/v1/platform/init", { method: "POST" }),
    onSuccess: (res) => {
      if (res && typeof res === "object" && "ok" in res && res.ok === false) {
        toast.error(
          (typeof res.error === "string" && res.error) || t("platform_init_failed"),
        )
        return
      }
      toast.success(t("platform_init_ok"))
      qc.invalidateQueries({ queryKey: ["platform-status"] })
    },
    onError: toastMutationError,
  })

  const info = data?.info ?? {}
  const cpuHistory = (history?.samples ?? []).map((s) => s.cpu_percent)
  const platformRows = flattenPlatform(platformData)

  const rows: { label: string; value: string | number | undefined }[] = [
    { label: t("hostname"), value: info.hostname },
    { label: t("kernel"), value: info.kernel },
    { label: t("os"), value: info.os },
    { label: t("uptime"), value: info.uptime_seconds },
    { label: t("load"), value: info.load_average },
    { label: t("collected_at"), value: info.collected_at },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <UsageBar label={tMetrics("cpu")} percent={info.cpu_percent} />
                <UsageBar label={tMetrics("mem")} percent={info.mem_percent} />
                <UsageBar label={tMetrics("disk")} percent={info.disk_percent} />
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-sm">{tMetrics("cpu")} (1h)</p>
                <Sparkline values={cpuHistory} />
              </div>
              <dl className="grid gap-3 md:grid-cols-2">
                {rows.map((row) => (
                  <div key={row.label} className="rounded-md border p-3 text-sm">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="mt-1 break-all font-mono text-xs" dir="ltr">
                      {row.value ?? tCommon("em_dash")}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <h3 className="text-muted-foreground mb-2 text-sm font-medium">{t("memory")}</h3>
                  <pre className="overflow-auto text-xs" dir="ltr">
                    {info.memory ?? tCommon("em_dash")}
                  </pre>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="text-muted-foreground mb-2 text-sm font-medium">{t("disk")}</h3>
                  <pre className="overflow-auto text-xs" dir="ltr">
                    {info.disk ?? tCommon("em_dash")}
                  </pre>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("platform_status_title")}</CardTitle>
          <RequireRouteWrite>
            <Button
              type="button"
              size="sm"
              disabled={initPlatform.isPending}
              onClick={() => initPlatform.mutate(undefined)}
            >
              {initPlatform.isPending ? t("platform_init_running") : t("platform_init")}
            </Button>
          </RequireRouteWrite>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">{t("platform_status_hint")}</p>
          {platformLoading ? (
            <p>{tCommon("loading")}</p>
          ) : platformRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{tCommon("em_dash")}</p>
          ) : (
            <dl className="grid gap-3 md:grid-cols-2">
              {platformRows.map((row) => (
                <div key={row.label} className="rounded-md border p-3 text-sm">
                  <dt className="text-muted-foreground font-mono text-xs" dir="ltr">
                    {row.label}
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs" dir="ltr">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
