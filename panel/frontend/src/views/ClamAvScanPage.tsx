"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type ScanResult = {
  infected?: string[]
  count?: number
  output?: string
  ok?: boolean
}

type ScanRecord = {
  id: number
  path: string
  status: string
  infected: string[]
  count: number
  started_at: string | null
  finished_at: string | null
  error: string | null
}

type ScheduleSettings = {
  enabled: boolean
  path: string
}

type Tab = "scan" | "history" | "schedule"

export default function ClamAvScanPage() {
  const t = useTranslations("security")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>("scan")
  const [result, setResult] = useState<ScanResult | null>(null)

  const scan = useMutation({
    mutationFn: (path: string) =>
      api<ScanResult>("/api/v1/security/clamav/scan", {
        method: "POST",
        json: { path: path || "/" },
      }),
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ["clamav-history"] })
    },
  })

  const history = useQuery({
    queryKey: ["clamav-history"],
    queryFn: () => api<{ scans: ScanRecord[] }>("/api/v1/security/clamav/history"),
    enabled: tab === "history",
  })

  const schedule = useQuery({
    queryKey: ["clamav-schedule"],
    queryFn: () => api<ScheduleSettings>("/api/v1/security/clamav/schedule"),
    enabled: tab === "schedule",
  })

  const updateSchedule = useMutation({
    mutationFn: (body: ScheduleSettings) =>
      api<ScheduleSettings>("/api/v1/security/clamav/schedule", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clamav-schedule"] }),
  })

  const scans = history.data?.scans ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("clamav_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "scan" ? "default" : "outline"}
              onClick={() => setTab("scan")}
            >
              {t("clamav_tab_scan")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "history" ? "default" : "outline"}
              onClick={() => setTab("history")}
            >
              {t("clamav_tab_history")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "schedule" ? "default" : "outline"}
              onClick={() => setTab("schedule")}
            >
              {t("clamav_tab_schedule")}
            </Button>
          </div>

          {tab === "scan" && (
            <>
              <form
                className="flex flex-col gap-3 md:flex-row md:items-end"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  scan.mutate(String(fd.get("path") ?? "/"))
                }}
              >
                <div className="grow space-y-2">
                  <Label htmlFor="scan-path">{t("clamav_path")}</Label>
                  <Input id="scan-path" name="path" defaultValue="/" dir="ltr" />
                </div>
                <Button type="submit" disabled={scan.isPending}>
                  {scan.isPending ? t("clamav_scanning") : t("clamav_scan")}
                </Button>
              </form>

              {result && (
                <div className="space-y-3 rounded-md border p-4">
                  <p className="text-sm">
                    {result.ok
                      ? t("clamav_clean")
                      : t("clamav_infected", { count: result.count ?? 0 })}
                  </p>
                  {(result.infected ?? []).length > 0 && (
                    <ul className="list-inside list-disc text-sm" dir="ltr">
                      {result.infected!.map((file) => (
                        <li key={file}>{file}</li>
                      ))}
                    </ul>
                  )}
                  {result.output && (
                    <pre
                      className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs whitespace-pre-wrap"
                      dir="ltr"
                    >
                      {result.output}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "history" && (
            <>
              {history.isLoading ? (
                <p>{tCommon("loading")}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {scans.length === 0 ? (
                    <li className="text-muted-foreground px-4 py-3 text-sm">
                      {t("clamav_history_empty")}
                    </li>
                  ) : (
                    scans.map((s) => (
                      <li key={s.id} className="space-y-1 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs" dir="ltr">
                            {s.path}
                          </span>
                          <span
                            className={
                              s.status === "completed"
                                ? "text-green-600 dark:text-green-400"
                                : s.status === "failed"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            {s.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {s.count > 0
                            ? t("clamav_infected", { count: s.count })
                            : t("clamav_clean")}
                          {" · "}
                          {s.finished_at
                            ? new Date(s.finished_at).toLocaleString()
                            : s.started_at
                              ? new Date(s.started_at).toLocaleString()
                              : "—"}
                        </p>
                        {s.error && (
                          <p className="text-destructive text-xs" dir="ltr">
                            {s.error}
                          </p>
                        )}
                        {s.count > 0 && (
                          <ul className="list-inside list-disc text-xs" dir="ltr">
                            {s.infected.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </>
          )}

          {tab === "schedule" && (
            <>
              {schedule.isLoading ? (
                <p>{tCommon("loading")}</p>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    updateSchedule.mutate({
                      enabled: fd.get("enabled") === "on",
                      path: String(fd.get("path") ?? "/var/www"),
                    })
                  }}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="schedule-enabled"
                      name="enabled"
                      defaultChecked={schedule.data?.enabled ?? false}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="schedule-enabled">{t("clamav_schedule_enable")}</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-path">{t("clamav_schedule_path_label")}</Label>
                    <Input
                      id="schedule-path"
                      name="path"
                      defaultValue={schedule.data?.path ?? "/var/www"}
                      dir="ltr"
                    />
                    <p className="text-muted-foreground text-xs">{t("clamav_schedule_hint")}</p>
                  </div>
                  <Button type="submit" disabled={updateSchedule.isPending}>
                    {t("clamav_schedule_save")}
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
