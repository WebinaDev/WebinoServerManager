"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type DomainRow = {
  id: number
  domain: string
}

type PhpPool = {
  name: string
}

type AccountRow = {
  id: number
  username: string
  primary_domain: string | null
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
  hsts: boolean
  hosting_account_id: number | null
  status: string
  last_error: string | null
}

type EditState = {
  php_pool: string
  ssl_enabled: boolean
  force_https: boolean
  document_root: string
  hsts: boolean
  hosting_account_id: string
}

export default function SubdomainsPage() {
  const t = useTranslations("subdomains")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()

  const [editTarget, setEditTarget] = useState<SubdomainRow | null>(null)
  const [editState, setEditState] = useState<EditState>({
    php_pool: "",
    ssl_enabled: false,
    force_https: false,
    document_root: "",
    hsts: false,
    hosting_account_id: "",
  })

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api<{ domains: DomainRow[] }>("/api/v1/domains"),
  })

  const { data: phpPools } = useQuery({
    queryKey: ["php-pools"],
    queryFn: () => api<{ pools: PhpPool[] }>("/api/v1/php/pools"),
  })

  const { data: accountsData } = useQuery({
    queryKey: ["hosting-accounts"],
    queryFn: () => api<{ accounts: AccountRow[] }>("/api/v1/hosting/accounts"),
  })

  const { data, isLoading } = useQuery({
    queryKey: ["subdomains"],
    queryFn: () => api<{ subdomains: SubdomainRow[] }>("/api/v1/subdomains"),
  })

  const accounts = accountsData?.accounts ?? []

  const create = useMutation({
    mutationFn: (body: {
      parent_domain: string
      subdomain: string
      document_root?: string
      php_pool?: string
      ssl_enabled?: boolean
      force_https?: boolean
      hsts?: boolean
      hosting_account_id?: number | null
    }) => api("/api/v1/subdomains", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("add"))
      qc.invalidateQueries({ queryKey: ["subdomains"] })
    },
    onError: toastMutationError,
  })

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number
      body: Partial<{
        php_pool: string | null
        ssl_enabled: boolean
        force_https: boolean
        document_root: string
        hsts: boolean
        hosting_account_id: number | null
      }>
    }) =>
      api(`/api/v1/subdomains/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success(t("save"))
      qc.invalidateQueries({ queryKey: ["subdomains"] })
      setEditTarget(null)
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/subdomains/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete"))
      qc.invalidateQueries({ queryKey: ["subdomains"] })
    },
    onError: toastMutationError,
  })

  const openEdit = (s: SubdomainRow) => {
    setEditTarget(s)
    setEditState({
      php_pool: s.php_pool ?? "",
      ssl_enabled: s.ssl_enabled,
      force_https: s.force_https,
      document_root: s.document_root,
      hsts: s.hsts,
      hosting_account_id: s.hosting_account_id ? String(s.hosting_account_id) : "",
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-6"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const accountId = String(fd.get("hosting_account_id") ?? "")
                create.mutate({
                  parent_domain: String(fd.get("parent_domain") ?? ""),
                  subdomain: String(fd.get("subdomain") ?? ""),
                  document_root: String(fd.get("document_root") ?? "") || undefined,
                  php_pool: String(fd.get("php_pool") ?? "") || undefined,
                  ssl_enabled: fd.get("ssl_enabled") === "on",
                  force_https: fd.get("force_https") === "on",
                  hsts: fd.get("hsts") === "on",
                  hosting_account_id: accountId ? Number(accountId) : null,
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="parent_domain">{t("field_parent")}</Label>
                <select
                  id="parent_domain"
                  name="parent_domain"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                  required
                >
                  <option value="">{t("select_parent")}</option>
                  {(domains?.domains ?? []).map((d) => (
                    <option key={d.id} value={d.domain}>
                      {d.domain}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subdomain">{t("field_subdomain")}</Label>
                <Input id="subdomain" name="subdomain" required dir="ltr" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document_root">{t("field_docroot")}</Label>
                <Input
                  id="document_root"
                  name="document_root"
                  placeholder="sites/sub.example.com/public"
                  dir="ltr"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="php_pool">{t("field_php_pool")}</Label>
                <select
                  id="php_pool"
                  name="php_pool"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">{t("no_php_pool")}</option>
                  {(phpPools?.pools ?? []).map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_hosting_account_id">{t("field_hosting_account")}</Label>
                <select
                  id="create_hosting_account_id"
                  name="hosting_account_id"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">{t("no_account")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end gap-1 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="ssl_enabled" />
                  {t("ssl_enabled")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="force_https" />
                  {t("force_https")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="hsts" />
                  {t("field_hsts")}
                </label>
              </div>
              <div className="flex items-end md:col-span-6">
                <Button type="submit" disabled={create.isPending}>
                  {t("add")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>

          {isLoading ? (
            <p>{tCommon("loading")}</p>
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
                      {s.hsts ? " · HSTS" : ""}
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
                        onClick={() => openEdit(s)}
                      >
                        {t("edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(s.id)}
                      >
                        {t("delete")}
                      </Button>
                    </RequireRouteWrite>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!editTarget) return
              update.mutate({
                id: editTarget.id,
                body: {
                  php_pool: editState.php_pool || null,
                  ssl_enabled: editState.ssl_enabled,
                  force_https: editState.force_https,
                  document_root: editState.document_root,
                  hsts: editState.hsts,
                  hosting_account_id: editState.hosting_account_id
                    ? Number(editState.hosting_account_id)
                    : null,
                },
              })
            }}
          >
            <div className="space-y-2">
              <Label>{t("field_docroot")}</Label>
              <Input
                dir="ltr"
                className="font-mono"
                value={editState.document_root}
                onChange={(e) =>
                  setEditState((p) => ({ ...p, document_root: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("field_php_pool")}</Label>
              <select
                value={editState.php_pool}
                onChange={(e) =>
                  setEditState((p) => ({ ...p, php_pool: e.target.value }))
                }
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">{t("no_php_pool")}</option>
                {(phpPools?.pools ?? []).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("field_hosting_account")}</Label>
              <select
                value={editState.hosting_account_id}
                onChange={(e) =>
                  setEditState((p) => ({ ...p, hosting_account_id: e.target.value }))
                }
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">{t("no_account")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editState.ssl_enabled}
                  onChange={(e) =>
                    setEditState((p) => ({ ...p, ssl_enabled: e.target.checked }))
                  }
                />
                {t("ssl_enabled")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editState.force_https}
                  onChange={(e) =>
                    setEditState((p) => ({ ...p, force_https: e.target.checked }))
                  }
                />
                {t("force_https")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editState.hsts}
                  onChange={(e) =>
                    setEditState((p) => ({ ...p, hsts: e.target.checked }))
                  }
                />
                {t("field_hsts")}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditTarget(null)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
