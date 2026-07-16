"use client"

import { useTranslations } from "next-intl"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type MailRow = { id: number; address: string; status: string }

type TicketResponse = {
  data: { ticket: string; embed_path: string; expires_in: number }
}

export default function WebmailPage() {
  const t = useTranslations("webmail")
  const tCommon = useTranslations("common")
  const [accounts, setAccounts] = useState<MailRow[]>([])
  const [accountId, setAccountId] = useState<string>("")
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)

  useEffect(() => {
    api<{ accounts: MailRow[] }>("/api/v1/email/accounts")
      .then((r) => setAccounts(r.accounts ?? []))
      .catch(() => setAccounts([]))
  }, [])

  const open = useMutation({
    mutationFn: () =>
      api<TicketResponse>("/api/v1/embeds/webmail/ticket", {
        method: "POST",
        json: accountId ? { mail_account_id: Number(accountId) } : {},
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
              <Label htmlFor="mail_account_id">{t("field_account")}</Label>
              <select
                id="mail_account_id"
                className="border-input bg-background flex h-9 min-w-[12rem] rounded-md border px-3 text-sm"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">{t("no_account")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.address}
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
