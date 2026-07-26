"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type SiteRow = {
  slug?: string
  domain?: string
  product?: string
  channel?: string
}

type SitesResponse = {
  ok?: boolean
  sites?: SiteRow[]
  data?: SiteRow[]
  output?: string
  error?: string
}

type CreateSiteBody = {
  slug: string
  domain: string
  product?: string
  channel?: string
  aliases?: string[]
  env?: Record<string, string>
}

export default function SitesPage() {
  const t = useTranslations("sites")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const { data, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api<SitesResponse>("/api/v1/sites"),
  })

  const create = useMutation({
    mutationFn: (body: CreateSiteBody) =>
      api<SitesResponse>("/api/v1/sites", { method: "POST", json: body }),
    onSuccess: (res) => {
      if (res?.ok === false) {
        toast.error(res.error || t("create_failed"))
        return
      }
      toast.success(t("create_ok"))
      formRef.current?.reset()
      qc.invalidateQueries({ queryKey: ["sites"] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (slug: string) =>
      api<{ ok?: boolean; error?: string }>(
        `/api/v1/sites/${encodeURIComponent(slug)}`,
        { method: "DELETE" },
      ),
    onSuccess: (res) => {
      if (res?.ok === false) {
        toast.error(res.error || t("delete_failed"))
        return
      }
      toast.success(t("delete_ok"))
      qc.invalidateQueries({ queryKey: ["sites"] })
    },
    onError: toastMutationError,
  })

  const sites = data?.sites ?? (Array.isArray(data?.data) ? data.data : [])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              ref={formRef}
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const aliasesRaw = String(fd.get("aliases") ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                const envKey = String(fd.get("env_key") ?? "").trim()
                const envVal = String(fd.get("env_value") ?? "").trim()
                const body: CreateSiteBody = {
                  slug: String(fd.get("slug") ?? ""),
                  domain: String(fd.get("domain") ?? ""),
                  product: String(fd.get("product") ?? "") || undefined,
                  channel: String(fd.get("channel") ?? "") || undefined,
                }
                if (aliasesRaw.length) body.aliases = aliasesRaw
                if (envKey) body.env = { [envKey]: envVal }
                create.mutate(body)
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
                <select
                  id="product"
                  name="product"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">{t("product_none")}</option>
                  <option value="Webino">Webino</option>
                  <option value="WebinoERM">WebinoERM</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">{t("field_channel")}</Label>
                <select
                  id="channel"
                  name="channel"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue="LTS"
                >
                  <option value="LTS">LTS</option>
                  <option value="Dev">Dev</option>
                  <option value="Beta">Beta</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="aliases">{t("field_aliases")}</Label>
                <Input
                  id="aliases"
                  name="aliases"
                  dir="ltr"
                  placeholder={t("aliases_placeholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="env_key">{t("field_env_key")}</Label>
                <Input id="env_key" name="env_key" dir="ltr" placeholder="APP_DEBUG" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="env_value">{t("field_env_value")}</Label>
                <Input id="env_value" name="env_value" dir="ltr" placeholder="true" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? tCommon("loading") : t("create")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : sites.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sites.map((s, i) => (
                <li
                  key={`${s.slug ?? i}`}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span dir="ltr">
                    {s.slug} · {s.domain}
                    {s.product ? ` · ${s.product}` : ""}
                    {s.channel ? ` · ${s.channel}` : ""}
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
