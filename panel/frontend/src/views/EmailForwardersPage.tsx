"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type MailForwarder = {
  id: number
  source: string
  destination: string
  status: string
}

export default function EmailForwardersPage() {
  const { t } = useTranslation(["email", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["email-forwarders"],
    queryFn: () =>
      api<{ forwarders: MailForwarder[] }>("/api/v1/email/forwarders"),
  })

  const create = useMutation({
    mutationFn: (body: { source: string; destination: string }) =>
      api("/api/v1/email/forwarders", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-forwarders"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/email/forwarders/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-forwarders"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("email:forwarders_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                source: String(fd.get("source") ?? ""),
                destination: String(fd.get("destination") ?? ""),
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="source">{t("email:field_source")}</Label>
              <Input id="source" name="source" type="email" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">{t("email:field_destination")}</Label>
              <Input
                id="destination"
                name="destination"
                type="email"
                required
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {t("email:add_forwarder")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.forwarders ?? []).map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span dir="ltr">
                    {f.source} → {f.destination}
                  </span>
                  <span className="text-muted-foreground">{f.status}</span>
                  <RequireRouteWrite>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove.mutate(f.id)}
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
