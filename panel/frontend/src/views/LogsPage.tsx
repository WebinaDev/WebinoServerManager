"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

export default function LogsPage() {
  const { t } = useTranslation(["monitoring", "common"])
  const [source, setSource] = useState("")
  const [lines, setLines] = useState(200)

  const { data: sourcesData } = useQuery({
    queryKey: ["monitoring-log-sources"],
    queryFn: () => api<{ sources: string[] }>("/api/v1/monitoring/logs/sources"),
  })

  const sources = sourcesData?.sources ?? []

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["monitoring-logs", source, lines],
    queryFn: () =>
      api<{ log: { content?: string } }>(
        `/api/v1/monitoring/logs?source=${encodeURIComponent(source)}&lines=${lines}`
      ),
    enabled: source !== "",
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("monitoring:logs_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="log-source">{t("monitoring:log_source")}</Label>
              <select
                id="log-source"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">{t("monitoring:select_source")}</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-lines">{t("monitoring:log_lines")}</Label>
              <Input
                id="log-lines"
                type="number"
                min={1}
                max={5000}
                value={lines}
                onChange={(e) => setLines(Number(e.target.value) || 100)}
                dir="ltr"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                disabled={!source || isFetching}
                onClick={() => refetch()}
              >
                {t("monitoring:refresh")}
              </Button>
            </div>
          </div>

          {source === "" ? (
            <p className="text-muted-foreground text-sm">{t("monitoring:select_source_hint")}</p>
          ) : isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <pre
              className="bg-muted max-h-[70vh] overflow-auto rounded p-3 text-xs whitespace-pre-wrap"
              dir="ltr"
            >
              {data?.log?.content ?? t("monitoring:logs_empty")}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
