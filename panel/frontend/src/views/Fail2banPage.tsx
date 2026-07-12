"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type JailDetail = {
  name: string
  detail: string
}

type Fail2banData = {
  jails?: JailDetail[]
  raw?: string
}

type FilterRow = {
  name: string
  content: string
}

type Tab = "jails" | "filters" | "unban"

export default function Fail2banPage() {
  const { t } = useTranslation(["security", "common"])
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>("jails")

  const { data, isLoading } = useQuery({
    queryKey: ["fail2ban"],
    queryFn: () => api<Fail2banData>("/api/v1/security/fail2ban"),
    enabled: tab === "jails",
  })

  const filters = useQuery({
    queryKey: ["fail2ban-filters"],
    queryFn: () => api<{ filters: FilterRow[] }>("/api/v1/security/fail2ban/filters"),
    enabled: tab === "filters",
  })

  const unban = useMutation({
    mutationFn: (body: { jail: string; ip: string }) =>
      api("/api/v1/security/fail2ban/unban", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fail2ban"] }),
  })

  const saveFilter = useMutation({
    mutationFn: (body: { name: string; content: string }) =>
      api("/api/v1/security/fail2ban/filters", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fail2ban-filters"] }),
  })

  const jails = data?.jails ?? []
  const filterRows = filters.data?.filters ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("security:fail2ban_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "jails" ? "default" : "outline"}
              onClick={() => setTab("jails")}
            >
              {t("security:fail2ban_tab_jails")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "filters" ? "default" : "outline"}
              onClick={() => setTab("filters")}
            >
              {t("security:fail2ban_tab_filters")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "unban" ? "default" : "outline"}
              onClick={() => setTab("unban")}
            >
              {t("security:fail2ban_tab_unban")}
            </Button>
          </div>

          {tab === "jails" && (
            <>
              {isLoading ? (
                <p>{t("common:loading")}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {jails.length === 0 ? (
                    <li className="text-muted-foreground px-4 py-3 text-sm">
                      {t("security:fail2ban_no_jails")}
                    </li>
                  ) : (
                    jails.map((jail) => (
                      <li key={jail.name} className="space-y-2 px-4 py-3 text-sm">
                        <p className="font-medium" dir="ltr">
                          {jail.name}
                        </p>
                        <pre
                          className="bg-muted overflow-x-auto rounded p-2 text-xs whitespace-pre-wrap"
                          dir="ltr"
                        >
                          {jail.detail}
                        </pre>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </>
          )}

          {tab === "filters" && (
            <div className="space-y-4">
              {filters.isLoading ? (
                <p>{t("common:loading")}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {filterRows.length === 0 ? (
                    <li className="text-muted-foreground px-4 py-3 text-sm">
                      {t("security:fail2ban_no_filters")}
                    </li>
                  ) : (
                    filterRows.map((f) => (
                      <li key={f.name} className="space-y-2 px-4 py-3 text-sm">
                        <p className="font-medium" dir="ltr">
                          {f.name}
                        </p>
                        <pre
                          className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs whitespace-pre-wrap"
                          dir="ltr"
                        >
                          {f.content}
                        </pre>
                      </li>
                    ))
                  )}
                </ul>
              )}

              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  saveFilter.mutate({
                    name: String(fd.get("name") ?? ""),
                    content: String(fd.get("content") ?? ""),
                  })
                  e.currentTarget.reset()
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="filter-name">{t("security:fail2ban_filter_name")}</Label>
                  <Input id="filter-name" name="name" required dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-content">{t("security:fail2ban_filter_content")}</Label>
                  <textarea
                    id="filter-content"
                    name="content"
                    required
                    dir="ltr"
                    className="border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 font-mono text-sm"
                  />
                </div>
                <Button type="submit" disabled={saveFilter.isPending}>
                  {t("security:fail2ban_filter_save")}
                </Button>
              </form>
            </div>
          )}

          {tab === "unban" && (
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                unban.mutate({
                  jail: String(fd.get("jail") ?? ""),
                  ip: String(fd.get("ip") ?? ""),
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="unban-jail">{t("security:fail2ban_jail")}</Label>
                <Input id="unban-jail" name="jail" required dir="ltr" list="jail-names" />
                <datalist id="jail-names">
                  {jails.map((j) => (
                    <option key={j.name} value={j.name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unban-ip">{t("security:fail2ban_ip")}</Label>
                <Input id="unban-ip" name="ip" required dir="ltr" placeholder="203.0.113.1" />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={unban.isPending}>
                  {t("security:fail2ban_unban")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
