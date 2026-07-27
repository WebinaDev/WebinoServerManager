"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { AccentBarChart, AccentGaugeChart } from "@/components/charts/AccentCharts"
import { LocaleDatePickerDate } from "@/components/LocaleDatePicker"
import { useLocale } from "@/hooks/useLocale"
import { api } from "@/lib/api"

type Summary = {
  domains: number
  databases: number
  sites: number
  hosting_accounts?: number
  hosting_suspended?: number
  system_status: string
  cpu_percent?: number
  mem_percent?: number
  disk_percent?: number
  net_rx_bps?: number | null
  net_tx_bps?: number | null
  disk_read_bps?: number | null
  disk_write_bps?: number | null
  top_processes?: Array<{
    pid: number
    user: string
    cpu: number
    mem: number
    command: string
  }>
  security_risk?: {
    level: string
    items: Array<{ key: string; label: string; href: string; severity: string }>
  }
  softstore_pins?: Array<{
    package_id: number
    slug?: string | null
    name?: string | null
    category?: string | null
  }>
  softstore_active_installs?: number
  softstore_recent_installs?: Array<{
    id: number
    status: string
    package?: string | null
    log?: string | null
  }>
}

function formatBps(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return "—"
  if (n < 1024) return `${Math.round(n)} B/s`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB/s`
  return `${(n / (1024 * 1024)).toFixed(2)} MB/s`
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="text-muted-foreground h-10 text-xs">—</div>
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(max - min, 1)
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100
      const y = 100 - ((v - min) / span) * 100
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="text-primary h-10 w-full">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiCard({
  href,
  label,
  value,
  hint,
}: {
  href: string
  label: string
  value: string
  hint?: string | null
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-4 text-card-foreground shadow transition-colors hover:bg-muted/40"
    >
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint ? <div className="text-muted-foreground mt-1 text-xs">{hint}</div> : null}
    </Link>
  )
}

type Props = {
  initialSummary?: Summary | null
}

export default function DashboardHome({ initialSummary = null }: Props) {
  const t = useTranslations("dashboard")
  const tMetrics = useTranslations("metrics")
  const tCommon = useTranslations("common")
  const { formatNumber, formatNowDate, formatLocalizedDate } = useLocale()
  const [summary, setSummary] = useState<Summary | null>(initialSummary)
  const [picked, setPicked] = useState<Date | null>(() => new Date())

  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => api<{ timezone?: string }>("/api/v1/auth/user"),
  })

  const { data: metricsHistory } = useQuery({
    queryKey: ["dashboard-metrics-history"],
    queryFn: () =>
      api<{
        samples: Array<{
          net_rx_bps?: number | null
          net_tx_bps?: number | null
          disk_read_bps?: number | null
          disk_write_bps?: number | null
        }>
      }>("/api/v1/metrics/history?range=1h"),
  })

  const timeZone = authUser?.timezone ?? "UTC"
  const netSpark = (metricsHistory?.samples ?? []).map((s) => (s.net_rx_bps ?? 0) + (s.net_tx_bps ?? 0))
  const diskSpark = (metricsHistory?.samples ?? []).map(
    (s) => (s.disk_read_bps ?? 0) + (s.disk_write_bps ?? 0)
  )

  useEffect(() => {
    if (initialSummary) {
      return
    }
    let cancelled = false
    api<Summary>("/api/v1/dashboard/summary")
      .then((data) => {
        if (!cancelled) {
          setSummary(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [initialSummary])

  const statusLabel =
    summary?.system_status === "alert"
      ? t("status_alert")
      : summary?.system_status === "warning"
        ? t("status_warning")
        : summary?.system_status === "unknown"
          ? t("status_unknown")
          : t("status_ok")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("sample_date_label")}: {formatNowDate(timeZone)}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <span className="text-muted-foreground text-sm">
            {t("pick_date_label")}
          </span>
          <LocaleDatePickerDate
            value={picked}
            onChange={setPicked}
            aria-label={t("pick_date_label")}
          />
          <span className="text-muted-foreground text-sm">
            {t("selected_date_label")}:{" "}
            {picked
              ? formatLocalizedDate(picked, timeZone)
              : tCommon("em_dash")}
          </span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          href="/domains"
          label={t("kpi_domains")}
          value={summary ? formatNumber(summary.domains) : tCommon("em_dash")}
        />
        <KpiCard
          href="/databases"
          label={t("kpi_databases")}
          value={summary ? formatNumber(summary.databases) : tCommon("em_dash")}
        />
        <KpiCard
          href="/websites"
          label={t("kpi_sites")}
          value={summary ? formatNumber(summary.sites) : tCommon("em_dash")}
        />
        <KpiCard
          href="/hosting/accounts"
          label={t("kpi_hosting")}
          value={
            summary ? formatNumber(summary.hosting_accounts ?? 0) : tCommon("em_dash")
          }
          hint={
            summary && (summary.hosting_suspended ?? 0) > 0
              ? t("kpi_hosting_suspended", {
                  count: formatNumber(summary.hosting_suspended ?? 0),
                })
              : null
          }
        />
        <KpiCard
          href="/system-info"
          label={t("kpi_system")}
          value={statusLabel}
        />
      </div>
      {(summary?.softstore_pins?.length ?? 0) > 0 ||
      (summary?.softstore_active_installs ?? 0) > 0 ||
      (summary?.softstore_recent_installs?.length ?? 0) > 0 ? (
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">{t("softstore_pins_title")}</div>
            <Link href="/softstore" className="text-primary text-sm hover:underline">
              {t("softstore_open")}
            </Link>
          </div>
          {(summary?.softstore_active_installs ?? 0) > 0 ? (
            <p className="text-muted-foreground mb-2 text-xs">
              {t("softstore_active_installs", {
                count: formatNumber(summary?.softstore_active_installs ?? 0),
              })}
            </p>
          ) : null}
          <ul className="flex flex-wrap gap-2">
            {(summary?.softstore_pins ?? []).map((pin) => (
              <li key={pin.package_id}>
                <Link
                  href="/softstore"
                  className="bg-muted hover:bg-muted/80 inline-block rounded-md px-3 py-1 text-sm"
                >
                  {pin.name ?? pin.slug ?? `#${pin.package_id}`}
                </Link>
              </li>
            ))}
          </ul>
          {(summary?.softstore_recent_installs?.length ?? 0) > 0 ? (
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium">{t("task_box_title")}</div>
              <ul className="divide-y rounded-md border text-sm">
                {(summary?.softstore_recent_installs ?? []).map((job) => (
                  <li key={job.id} className="px-3 py-2">
                    <Link href="/softstore" className="block hover:bg-muted/40 -mx-3 -my-2 px-3 py-2">
                      <div className="flex justify-between gap-2">
                        <span>{job.package ?? `#${job.id}`}</span>
                        <span className="text-muted-foreground">{job.status}</span>
                      </div>
                      {job.log ? (
                        <p className="text-muted-foreground mt-1 truncate text-xs" dir="ltr">
                          {job.log}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {summary?.security_risk ? (
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">{t("risk_title")}</div>
            <span className="text-muted-foreground text-xs">{summary.security_risk.level}</span>
          </div>
          <ul className="space-y-1 text-sm">
            {summary.security_risk.items.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="text-primary hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(summary?.top_processes?.length ?? 0) > 0 ? (
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">{t("top_processes_title")}</div>
            <Link
              href="/monitoring/processes"
              className="text-primary text-sm hover:underline"
            >
              {t("top_processes_open")}
            </Link>
          </div>
          <ul className="divide-y rounded-md border text-sm">
            {(summary?.top_processes ?? []).map((p) => (
              <li key={p.pid} className="flex justify-between gap-2 px-3 py-2 font-mono text-xs" dir="ltr">
                <span>
                  {p.pid} {p.command}
                </span>
                <span className="text-muted-foreground">
                  {p.cpu}% / {p.mem}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 shadow">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-muted-foreground text-sm">{t("nic_title")}</div>
              <Link href="/metrics-alerts" className="text-primary text-xs hover:underline">
                {t("io_open_metrics")}
              </Link>
            </div>
            <p className="mb-2 text-sm" dir="ltr">
              RX {formatBps(summary.net_rx_bps)} · TX {formatBps(summary.net_tx_bps)}
            </p>
            <Sparkline values={netSpark} />
          </div>
          <div className="rounded-xl border bg-card p-4 shadow">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-muted-foreground text-sm">{t("disk_io_title")}</div>
              <Link href="/metrics-alerts" className="text-primary text-xs hover:underline">
                {t("io_open_metrics")}
              </Link>
            </div>
            <p className="mb-2 text-sm" dir="ltr">
              R {formatBps(summary.disk_read_bps)} · W {formatBps(summary.disk_write_bps)}
            </p>
            <Sparkline values={diskSpark} />
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="rounded-xl border bg-card p-4 shadow">
          <AccentBarChart
            data={[
              { label: t("kpi_domains"), value: summary.domains },
              { label: t("kpi_databases"), value: summary.databases },
              { label: t("kpi_sites"), value: summary.sites },
              {
                label: t("kpi_hosting"),
                value: summary.hosting_accounts ?? 0,
              },
            ]}
          />
        </div>
      ) : null}
      {summary?.cpu_percent != null ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow">
            <AccentGaugeChart label={tMetrics("cpu")} percent={summary.cpu_percent} />
          </div>
          <div className="rounded-xl border bg-card p-4 shadow">
            <AccentGaugeChart label={tMetrics("mem")} percent={summary.mem_percent} />
          </div>
          <div className="rounded-xl border bg-card p-4 shadow">
            <AccentGaugeChart label={tMetrics("disk")} percent={summary.disk_percent} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
