"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type Autoresponder = {
  id: number
  address: string
  subject: string
  body: string
  status: string
}

export default function AutorespondersPage() {
  const { t } = useTranslation(["email", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["email-autoresponders"],
    queryFn: () =>
      api<{ autoresponders: Autoresponder[] }>("/api/v1/email/autoresponders"),
  })

  const create = useMutation({
    mutationFn: (body: { address: string; subject?: string; body: string }) =>
      api("/api/v1/email/autoresponders", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-autoresponders"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/email/autoresponders/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-autoresponders"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("email:autoresponders_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                address: String(fd.get("address") ?? ""),
                subject: String(fd.get("subject") ?? "") || undefined,
                body: String(fd.get("body") ?? ""),
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="address">{t("email:field_address")}</Label>
              <Input id="address" name="address" type="email" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">{t("email:autoresponders_subject")}</Label>
              <Input id="subject" name="subject" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">{t("email:autoresponders_body")}</Label>
              <Textarea id="body" name="body" required rows={4} />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {t("email:autoresponders_add")}
            </Button>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.autoresponders ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="space-y-1">
                    <p dir="ltr" className="font-medium">
                      {a.address}
                    </p>
                    <p className="text-muted-foreground">{a.subject}</p>
                    <p className="text-muted-foreground line-clamp-2 text-xs">{a.body}</p>
                    <span className="text-muted-foreground text-xs">{a.status}</span>
                  </div>
                  <RequireRouteWrite>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove.mutate(a.id)}
                    >
                      {t("email:delete")}
                    </Button>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
