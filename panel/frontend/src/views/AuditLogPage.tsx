"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLocale } from "@/hooks/useLocale"
import { api } from "@/lib/api"

type AuditUser = {
  id: number
  name: string
  username: string
}

type AuditLogRow = {
  id: number
  action: string
  target: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
  user?: AuditUser | null
}

type LoginHistoryRow = {
  id: number
  username: string | null
  ip: string | null
  user_agent: string | null
  success: boolean
  created_at: string
  user?: AuditUser | null
}

type Tab = "audit" | "login"

export default function AuditLogPage() {
  const t = useTranslations("security")
  const tCommon = useTranslations("common")
  const { formatDateTime } = useLocale()
  const [tab, setTab] = useState<Tab>("audit")

  const audit = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => api<{ logs: AuditLogRow[] }>("/api/v1/security/audit-log"),
    enabled: tab === "audit",
  })

  const login = useQuery({
    queryKey: ["login-history"],
    queryFn: () => api<{ history: LoginHistoryRow[] }>("/api/v1/security/login-history"),
    enabled: tab === "login",
  })

  const isLoading = tab === "audit" ? audit.isLoading : login.isLoading

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("audit_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "audit" ? "default" : "outline"}
              onClick={() => setTab("audit")}
            >
              {t("audit_tab")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "login" ? "default" : "outline"}
              onClick={() => setTab("login")}
            >
              {t("login_tab")}
            </Button>
          </div>

          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : tab === "audit" ? (
            <ul className="divide-y rounded-md border">
              {(audit.data?.logs ?? []).length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">
                  {t("audit_empty")}
                </li>
              ) : (
                audit.data!.logs.map((row) => (
                  <li key={row.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{row.action}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(row.created_at)}
                      </span>
                    </div>
                    {row.target && (
                      <p className="text-muted-foreground" dir="ltr">
                        {row.target}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs" dir="ltr">
                      {row.user?.username ?? "—"} · {row.ip ?? "—"}
                    </p>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <ul className="divide-y rounded-md border">
              {(login.data?.history ?? []).length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">
                  {t("login_empty")}
                </li>
              ) : (
                login.data!.history.map((row) => (
                  <li key={row.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium" dir="ltr">
                        {row.username ?? row.user?.username ?? "—"}
                      </span>
                      <span
                        className={
                          row.success ? "text-green-600 text-xs" : "text-destructive text-xs"
                        }
                      >
                        {row.success ? t("login_success") : t("login_failed")}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(row.created_at)} · <span dir="ltr">{row.ip ?? "—"}</span>
                    </p>
                  </li>
                ))
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
