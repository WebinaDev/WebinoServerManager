"use client"

import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-primary" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  )
}

export default function SystemInfoPage() {
  const t = useTranslations("system")
  const tMetrics = useTranslations("metrics")
  const tCommon = useTranslations("common")
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
    queryFn: () => api<Record<string, unknown>>("/api/v1/platform/status"),
    refetchInterval: 60_000,
  })

  const info = data?.info ?? {}
  const cpuHistory = (history?.samples ?? []).map((s) => s.cpu_percent)

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
                    <dd className="mt-1 font-mono text-xs break-all" dir="ltr">
                      {row.value ?? tCommon("em_dash")}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                    {t("memory")}
                  </h3>
                  <pre className="overflow-auto text-xs" dir="ltr">
                    {info.memory ?? tCommon("em_dash")}
                  </pre>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                    {t("disk")}
                  </h3>
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
        <CardHeader>
          <CardTitle>{t("platform_status_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {platformLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <pre className="overflow-auto rounded-md border p-3 text-xs" dir="ltr">
              {JSON.stringify(platformData ?? {}, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
