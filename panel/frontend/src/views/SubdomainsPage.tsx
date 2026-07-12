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
}

type PhpPool = {
  name: string
}

type SubdomainRow = {
  id: number
  parent_domain: string
  subdomain: string
  fqdn: string
  document_root: string
  php_pool: string | null
  ssl_enabled: boolean
  force_https: boolean
  status: string
  last_error: string | null
}

export default function SubdomainsPage() {
  const { t } = useTranslation(["subdomains", "common"])
  const qc = useQueryClient()

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api<{ domains: DomainRow[] }>("/api/v1/domains"),
  })

  const { data: phpPools } = useQuery({
    queryKey: ["php-pools"],
    queryFn: () => api<{ pools: PhpPool[] }>("/api/v1/php/pools"),
  })

  const { data, isLoading } = useQuery({
    queryKey: ["subdomains"],
    queryFn: () => api<{ subdomains: SubdomainRow[] }>("/api/v1/subdomains"),
  })

  const create = useMutation({
    mutationFn: (body: {
      parent_domain: string
      subdomain: string
      document_root?: string
      php_pool?: string
      ssl_enabled?: boolean
      force_https?: boolean
    }) => api("/api/v1/subdomains", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subdomains"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/subdomains/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subdomains"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("subdomains:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                parent_domain: String(fd.get("parent_domain") ?? ""),
                subdomain: String(fd.get("subdomain") ?? ""),
                document_root: String(fd.get("document_root") ?? "") || undefined,
                php_pool: String(fd.get("php_pool") ?? "") || undefined,
                ssl_enabled: fd.get("ssl_enabled") === "on",
                force_https: fd.get("force_https") === "on",
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="parent_domain">{t("subdomains:field_parent")}</Label>
              <select
                id="parent_domain"
                name="parent_domain"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                required
              >
                <option value="">{t("subdomains:select_parent")}</option>
                {(domains?.domains ?? []).map((d) => (
                  <option key={d.id} value={d.domain}>
                    {d.domain}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">{t("subdomains:field_subdomain")}</Label>
              <Input id="subdomain" name="subdomain" required dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_root">{t("subdomains:field_docroot")}</Label>
              <Input
                id="document_root"
                name="document_root"
                placeholder="sites/sub.example.com/public"
                dir="ltr"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="php_pool">{t("subdomains:field_php_pool")}</Label>
              <select
                id="php_pool"
                name="php_pool"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">{t("subdomains:no_php_pool")}</option>
                {(phpPools?.pools ?? []).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="ssl_enabled" />
                {t("subdomains:ssl_enabled")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="force_https" />
                {t("subdomains:force_https")}
              </label>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending}>
                {t("subdomains:add")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.subdomains ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium font-mono" dir="ltr">
                      {s.fqdn}
                    </p>
                    <p className="text-muted-foreground text-xs font-mono" dir="ltr">
                      {s.document_root}
                      {s.php_pool ? ` · PHP: ${s.php_pool}` : ""}
                      {s.ssl_enabled ? " · SSL" : ""}
                      {s.force_https ? " · HTTPS" : ""}
                    </p>
                    {s.last_error ? (
                      <p className="text-destructive text-xs">{s.last_error}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{s.status}</span>
                    <RequireRouteWrite>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(s.id)}
                      >
                        {t("subdomains:delete")}
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
