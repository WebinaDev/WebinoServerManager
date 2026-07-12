"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type DomainRow = {
  id: number
  domain: string
  slug: string | null
  status: string
}

export default function DomainsPage() {
  const { t } = useTranslation(["domains", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api<{ domains: DomainRow[] }>("/api/v1/domains"),
  })

  const create = useMutation({
    mutationFn: (body: { domain: string; slug?: string }) =>
      api("/api/v1/domains", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("domains:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate({
                  domain: String(fd.get("domain") ?? ""),
                  slug: String(fd.get("slug") ?? "") || undefined,
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="domain">{t("domains:field_domain")}</Label>
                <Input id="domain" name="domain" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">{t("domains:field_slug")}</Label>
                <Input id="slug" name="slug" />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={create.isPending}>
                  {t("domains:add")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.domains ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>{d.domain}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{d.status}</span>
                    <RequireRouteWrite>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("domains:delete_confirm"))) {
                            remove.mutate(d.id)
                          }
                        }}
                      >
                        {t("domains:delete")}
                      </Button>
                    </RequireRouteWrite>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
