"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { LocaleDatePicker } from "@/components/LocaleDatePicker"
import { api } from "@/lib/api"
import { formatInteger, formatLocalizedDate, formatNowDate } from "@/lib/format"

type Summary = {
  domains: number
  databases: number
  sites: number
  system_status: string
  cpu_percent?: number
  mem_percent?: number
  disk_percent?: number
}

function MiniBar({ label, percent }: { label: string; percent?: number }) {
  const pct = Math.min(100, Math.max(0, percent ?? 0))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono" dir="ltr">
          {percent != null ? `${pct.toFixed(0)}%` : "—"}
        </span>
      </div>
      <div className="bg-muted h-1.5 rounded-full overflow-hidden">
        <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function DashboardHome() {
  const { t, i18n } = useTranslation(["dashboard", "metrics", "common"])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [picked, setPicked] = useState<Date | null>(() => new Date())

  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => api<{ timezone?: string }>("/api/v1/auth/user"),
  })

  const timeZone = authUser?.timezone ?? "UTC"
  const lng = i18n.language.startsWith("fa")
    ? "fa"
    : i18n.language.startsWith("ar")
      ? "ar"
      : "en"

  useEffect(() => {
    let cancelled = false
    api<{ data: Summary }>("/api/v1/dashboard/summary")
      .then((r) => {
        if (!cancelled) {
          setSummary(r.data)
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
  }, [])

  const statusLabel =
    summary?.system_status === "alert"
      ? t("dashboard:status_alert")
      : summary?.system_status === "warning"
        ? t("dashboard:status_warning")
        : summary?.system_status === "unknown"
          ? t("dashboard:status_unknown")
          : t("dashboard:status_ok")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("dashboard:title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("dashboard:sample_date_label")}: {formatNowDate(lng, timeZone)}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="text-muted-foreground text-sm">
            {t("dashboard:pick_date_label")}
          </span>
          <LocaleDatePicker
            locale={i18n.language}
            value={picked}
            onChange={setPicked}
            aria-label={t("dashboard:pick_date_label")}
          />
          <span className="text-muted-foreground text-sm">
            {t("dashboard:selected_date_label")}:{" "}
            {picked
              ? formatLocalizedDate(lng, picked, timeZone)
              : t("common:em_dash")}
          </span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("dashboard:kpi_domains")}</div>
          <div className="text-2xl font-semibold">
            {summary ? formatInteger(summary.domains, lng) : t("common:em_dash")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("dashboard:kpi_databases")}</div>
          <div className="text-2xl font-semibold">
            {summary ? formatInteger(summary.databases, lng) : t("common:em_dash")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("dashboard:kpi_sites")}</div>
          <div className="text-2xl font-semibold">
            {summary ? formatInteger(summary.sites, lng) : t("common:em_dash")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="text-muted-foreground text-sm">{t("dashboard:kpi_system")}</div>
          <div className="text-2xl font-semibold">{statusLabel}</div>
        </div>
      </div>
      {summary?.cpu_percent != null ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow">
            <MiniBar label={t("metrics:cpu")} percent={summary.cpu_percent} />
          </div>
          <div className="rounded-xl border bg-card p-4 shadow">
            <MiniBar label={t("metrics:mem")} percent={summary.mem_percent} />
          </div>
          <div className="rounded-xl border bg-card p-4 shadow">
            <MiniBar label={t("metrics:disk")} percent={summary.disk_percent} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
