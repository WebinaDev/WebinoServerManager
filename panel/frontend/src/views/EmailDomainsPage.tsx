"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type MailDomain = {
  id: number
  domain: string
  status: string
  catch_all?: string | null
}

export default function EmailDomainsPage() {
  const t = useTranslations("email")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["email-domains"],
    queryFn: () => api<{ domains: MailDomain[] }>("/api/v1/email/domains"),
  })

  const create = useMutation({
    mutationFn: (domain: string) =>
      api("/api/v1/email/domains", { method: "POST", json: { domain } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-domains"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/email/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-domains"] }),
  })

  const updateCatchall = useMutation({
    mutationFn: ({ id, destination }: { id: number; destination: string }) =>
      api(`/api/v1/email/domains/${id}/catchall`, {
        method: "PATCH",
        json: { destination: destination || null },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-domains"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("domains_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="flex flex-col gap-3 md:flex-row md:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate(String(fd.get("domain") ?? ""))
                e.currentTarget.reset()
              }}
            >
              <div className="grow space-y-2">
                <Label htmlFor="domain">{t("domains_field")}</Label>
                <Input id="domain" name="domain" required dir="ltr" />
              </div>
              <Button type="submit" disabled={create.isPending}>
                {t("domains_add")}
              </Button>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.domains ?? []).map((d) => (
                <li key={d.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span dir="ltr">{d.domain}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{d.status}</span>
                      <RequireRouteWrite>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(t("domains_delete_confirm"))) {
                              remove.mutate(d.id)
                            }
                          }}
                        >
                          {t("delete")}
                        </Button>
                      </RequireRouteWrite>
                    </div>
                  </div>
                  <RequireRouteWrite>
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const fd = new FormData(e.currentTarget)
                        updateCatchall.mutate({
                          id: d.id,
                          destination: String(fd.get("catchall") ?? ""),
                        })
                      }}
                    >
                      <div className="grow space-y-1">
                        <Label htmlFor={`catchall-${d.id}`} className="text-xs">
                          {t("catchall")}
                        </Label>
                        <Input
                          id={`catchall-${d.id}`}
                          name="catchall"
                          type="email"
                          dir="ltr"
                          defaultValue={d.catch_all ?? ""}
                          placeholder={t("catchall_placeholder")}
                          className="h-8"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        disabled={updateCatchall.isPending}
                      >
                        {t("catchall_save")}
                      </Button>
                    </form>
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
