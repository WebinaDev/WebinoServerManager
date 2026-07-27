"use client"

import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type LogGroups = {
  panel?: string[]
  site?: string[]
  ftp?: string[]
}

function highlightLine(line: string, query: string): ReactNode {
  if (!query.trim()) return line
  const q = query
  const lower = line.toLowerCase()
  const idx = lower.indexOf(q.toLowerCase())
  if (idx < 0) return line
  return (
    <>
      {line.slice(0, idx)}
      <mark className="bg-yellow-300/60 text-inherit">{line.slice(idx, idx + q.length)}</mark>
      {line.slice(idx + q.length)}
    </>
  )
}

export default function LogsPage() {
  const t = useTranslations("monitoring")
  const tCommon = useTranslations("common")
  const [tab, setTab] = useState<"panel" | "site" | "ftp">("panel")
  const [source, setSource] = useState("")
  const [lines, setLines] = useState(200)
  const [filter, setFilter] = useState("")

  const { data: sourcesData } = useQuery({
    queryKey: ["monitoring-log-sources"],
    queryFn: () =>
      api<{ sources: string[]; groups?: LogGroups }>("/api/v1/monitoring/logs/sources"),
  })

  const groups = sourcesData?.groups ?? {}
  const tabSources = useMemo(
    () => groups[tab] ?? sourcesData?.sources ?? [],
    [groups, tab, sourcesData?.sources],
  )

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["monitoring-logs", source, lines],
    queryFn: () =>
      api<{ log: { content?: string } }>(
        `/api/v1/monitoring/logs?source=${encodeURIComponent(source)}&lines=${lines}`,
      ),
    enabled: source !== "",
  })

  const content = data?.log?.content ?? ""
  const contentLines = useMemo(() => content.split("\n"), [content])
  const filteredLines = useMemo(() => {
    if (!filter.trim()) return contentLines
    const q = filter.toLowerCase()
    return contentLines.filter((line) => line.toLowerCase().includes(q))
  }, [contentLines, filter])

  const errorHits = useMemo(
    () =>
      contentLines.filter((l) => /error|crit|fatal|fail/i.test(l)).length,
    [contentLines],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("logs_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["panel", "site", "ftp"] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={tab === key ? "default" : "outline"}
                onClick={() => {
                  setTab(key)
                  setSource("")
                }}
              >
                {t(`log_tab_${key}`)}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="log-source">{t("log_source")}</Label>
              <select
                id="log-source"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">{t("select_source")}</option>
                {tabSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-lines">{t("log_lines")}</Label>
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
            <div className="flex items-end gap-2">
              <Button
                type="button"
                disabled={!source || isFetching}
                onClick={() => refetch()}
              >
                {t("refresh")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!content}
                onClick={() => {
                  const blob = new Blob([filteredLines.join("\n")], {
                    type: "text/plain",
                  })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `${source || "log"}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                {t("log_export")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="log-filter">{t("log_filter")}</Label>
            <Input
              id="log-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("log_filter_placeholder")}
            />
          </div>

          {source && content ? (
            <p className="text-muted-foreground text-xs">
              {t("log_stats", {
                lines: filteredLines.length,
                total: contentLines.length,
                errors: errorHits,
              })}
            </p>
          ) : null}

          {source === "" ? (
            <p className="text-muted-foreground text-sm">{t("select_source_hint")}</p>
          ) : isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <pre
              className="bg-muted max-h-[70vh] overflow-auto rounded p-3 text-xs whitespace-pre-wrap"
              dir="ltr"
            >
              {filteredLines.length === 0
                ? t("logs_empty")
                : filteredLines.map((line, i) => (
                    <div key={`${i}-${line.slice(0, 24)}`}>
                      {highlightLine(line, filter)}
                    </div>
                  ))}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
