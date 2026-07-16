"use client"

import { useTranslations } from "next-intl"
import { useMutation } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type DbRow = { id: number; name: string; db_user: string | null; status: string }

type TicketResponse = {
  data: { ticket: string; embed_path: string; expires_in: number }
}

type PhpMyAdminPageProps = {
  initialDatabaseId?: number
}

export default function PhpMyAdminPage({ initialDatabaseId }: PhpMyAdminPageProps) {
  const t = useTranslations("phpmyadmin")
  const tDatabases = useTranslations("databases")
  const tCommon = useTranslations("common")
  const searchParams = useSearchParams()
  const queryDb = searchParams?.get("db") ?? null
  const [databases, setDatabases] = useState<DbRow[]>([])
  const [databaseId, setDatabaseId] = useState<string>(
    initialDatabaseId ? String(initialDatabaseId) : queryDb ?? ""
  )
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)

  useEffect(() => {
    api<{ databases: DbRow[] }>("/api/v1/databases")
      .then((r) => setDatabases(r.databases ?? []))
      .catch(() => setDatabases([]))
  }, [])

  const open = useMutation({
    mutationFn: () =>
      api<TicketResponse>("/api/v1/embeds/phpmyadmin/ticket", {
        method: "POST",
        json: databaseId ? { database_id: Number(databaseId) } : {},
      }),
    onSuccess: (res) => {
      const sep = res.data.embed_path.includes("?") ? "&" : "?"
      setIframeSrc(`${res.data.embed_path}${sep}ticket=${encodeURIComponent(res.data.ticket)}`)
    },
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="database_id">{t("field_database")}</Label>
              <select
                id="database_id"
                className="border-input bg-background flex h-9 min-w-[12rem] rounded-md border px-3 text-sm"
                value={databaseId}
                onChange={(e) => setDatabaseId(e.target.value)}
              >
                <option value="">{t("no_database")}</option>
                {databases.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" disabled={open.isPending} onClick={() => open.mutate()}>
              {t("open")}
            </Button>
          </div>
          {iframeSrc ? (
            <iframe
              title={t("title")}
              src={iframeSrc}
              className="h-[70vh] w-full rounded-md border"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          ) : (
            <p className="text-muted-foreground text-sm">{t("hint")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
