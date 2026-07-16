"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type SiteRow = {
  slug?: string
  domain?: string
  product?: string
}

export default function SitesPage() {
  const t = useTranslations("sites")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api<{ data?: SiteRow[]; sites?: SiteRow[] }>("/api/v1/sites"),
  })

  const create = useMutation({
    mutationFn: (body: { slug: string; domain: string; product?: string }) =>
      api("/api/v1/sites", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  })

  const remove = useMutation({
    mutationFn: (slug: string) =>
      api(`/api/v1/sites/${encodeURIComponent(slug)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  })

  const sites = data?.data ?? data?.sites ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                slug: String(fd.get("slug") ?? ""),
                domain: String(fd.get("domain") ?? ""),
                product: String(fd.get("product") ?? "") || undefined,
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="slug">{t("field_slug")}</Label>
              <Input id="slug" name="slug" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">{t("field_domain")}</Label>
              <Input id="domain" name="domain" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product">{t("field_product")}</Label>
              <Input id="product" name="product" dir="ltr" />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {t("create")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sites.map((s, i) => (
                <li
                  key={`${s.slug ?? i}`}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span dir="ltr">
                    {s.slug} · {s.domain} {s.product ? `· ${s.product}` : ""}
                  </span>
                  {s.slug ? (
                    <RequireRouteWrite>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(t("delete_confirm"))) {
                            remove.mutate(s.slug!)
                          }
                        }}
                      >
                        {t("delete")}
                      </Button>
                    </RequireRouteWrite>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
