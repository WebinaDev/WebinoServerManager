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
  softstore_pins?: Array<{
    package_id: number
    slug?: string | null
    name?: string | null
    category?: string | null
  }>
  softstore_active_installs?: number
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

  const timeZone = authUser?.timezone ?? "UTC"

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
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("kpi_domains")}</div>
          <div className="text-2xl font-semibold">
            {summary ? formatNumber(summary.domains) : tCommon("em_dash")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("kpi_databases")}</div>
          <div className="text-2xl font-semibold">
            {summary ? formatNumber(summary.databases) : tCommon("em_dash")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("kpi_sites")}</div>
          <div className="text-2xl font-semibold">
            {summary ? formatNumber(summary.sites) : tCommon("em_dash")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("kpi_hosting")}</div>
          <div className="text-2xl font-semibold">
            {summary
              ? formatNumber(summary.hosting_accounts ?? 0)
              : tCommon("em_dash")}
          </div>
          {summary && (summary.hosting_suspended ?? 0) > 0 ? (
            <div className="text-muted-foreground mt-1 text-xs">
              {t("kpi_hosting_suspended", {
                count: formatNumber(summary.hosting_suspended ?? 0),
              })}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("kpi_system")}</div>
          <div className="text-2xl font-semibold">{statusLabel}</div>
        </div>
      </div>
      {(summary?.softstore_pins?.length ?? 0) > 0 ||
      (summary?.softstore_active_installs ?? 0) > 0 ? (
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
