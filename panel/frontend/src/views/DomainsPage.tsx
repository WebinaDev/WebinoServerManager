"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { DataTable, type DataTableColumn } from "@/components/data-table"
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
  slug: string | null
  aliases: string | null
  hosting_account_id: number | null
  status: string
}

type AgentSite = {
  domain?: string
  name?: string
  [key: string]: unknown
}

type AccountRow = {
  id: number
  username: string
  primary_domain: string | null
}

export default function DomainsPage() {
  const t = useTranslations("domains")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const accountFilter = Number(searchParams.get("account") ?? "") || null

  const [editTarget, setEditTarget] = useState<DomainRow | null>(null)
  const [editAliases, setEditAliases] = useState("")
  const [editAccountId, setEditAccountId] = useState<string>("")

  const { data, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api<{ domains: DomainRow[]; sites: AgentSite[] }>("/api/v1/domains"),
  })

  const { data: accountsData } = useQuery({
    queryKey: ["hosting-accounts"],
    queryFn: () => api<{ accounts: AccountRow[] }>("/api/v1/hosting/accounts"),
  })

  const domains = (data?.domains ?? []).filter(
    (d) => accountFilter == null || d.hosting_account_id === accountFilter,
  )
  const sites = data?.sites ?? []
  const accounts = accountsData?.accounts ?? []

  const panelDomainNames = new Set(domains.map((d) => d.domain.toLowerCase()))
  const driftSites = sites.filter((s) => {
    const name = (s.domain ?? s.name ?? "").toLowerCase()
    return name && !panelDomainNames.has(name)
  })

  const create = useMutation({
    mutationFn: (body: {
      domain: string
      slug?: string
      aliases?: string
      hosting_account_id?: number | null
    }) => api("/api/v1/domains", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success(t("add"))
      qc.invalidateQueries({ queryKey: ["domains"] })
    },
    onError: toastMutationError,
  })

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number
      body: { aliases: string | null; hosting_account_id: number | null }
    }) =>
      api(`/api/v1/domains/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success(t("save"))
      qc.invalidateQueries({ queryKey: ["domains"] })
      setEditTarget(null)
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete"))
      qc.invalidateQueries({ queryKey: ["domains"] })
    },
    onError: toastMutationError,
  })

  const openEdit = (d: DomainRow) => {
    setEditTarget(d)
    setEditAliases(d.aliases ?? "")
    setEditAccountId(d.hosting_account_id ? String(d.hosting_account_id) : "")
  }

  const columns: DataTableColumn<DomainRow>[] = [
    {
      id: "domain",
      header: t("field_domain"),
      sortValue: (row) => row.domain,
      cell: (d) => <span dir="ltr">{d.domain}</span>,
    },
    {
      id: "aliases",
      header: t("field_aliases"),
      cell: (d) => (
        <span dir="ltr" className="text-muted-foreground text-xs">
          {d.aliases || "—"}
        </span>
      ),
    },
    {
      id: "hosting_account",
      header: t("field_hosting_account"),
      cell: (d) => {
        const acct = accounts.find((a) => a.id === d.hosting_account_id)
        return (
          <span className="text-muted-foreground text-xs">
            {acct ? acct.username : t("no_account")}
          </span>
        )
      },
    },
    {
      id: "status",
      header: tCommon("status"),
      sortValue: (row) => row.status,
      cell: (d) => <span className="text-muted-foreground">{d.status}</span>,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: (d) => (
        <RequireRouteWrite>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEdit(d)}
            >
              {t("edit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm(t("delete_confirm"))) {
                  remove.mutate(d.id)
                }
              }}
            >
              {t("delete")}
            </Button>
          </div>
        </RequireRouteWrite>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const accountId = String(fd.get("hosting_account_id") ?? "")
                create.mutate({
                  domain: String(fd.get("domain") ?? ""),
                  slug: String(fd.get("slug") ?? "") || undefined,
                  aliases: String(fd.get("aliases") ?? "") || undefined,
                  hosting_account_id: accountId ? Number(accountId) : null,
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="domain">{t("field_domain")}</Label>
                <Input id="domain" name="domain" dir="ltr" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">{t("field_slug")}</Label>
                <Input id="slug" name="slug" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aliases">{t("field_aliases")}</Label>
                <Input
                  id="aliases"
                  name="aliases"
                  dir="ltr"
                  placeholder="www.example.com example.net"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hosting_account_id">{t("field_hosting_account")}</Label>
                <select
                  id="hosting_account_id"
                  name="hosting_account_id"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                >
                  <option value="">{t("no_account")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.username}
                      {a.primary_domain ? ` (${a.primary_domain})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end md:col-span-4">
                <Button type="submit" disabled={create.isPending}>
                  {t("add")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>
          <DataTable
            columns={columns}
            data={domains}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("search")}
            searchFilter={(row, q) =>
              row.domain.toLowerCase().includes(q) ||
              row.status.toLowerCase().includes(q) ||
              (row.aliases ?? "").toLowerCase().includes(q)
            }
            emptyMessage={t("empty")}
          />
        </CardContent>
      </Card>

      {driftSites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("registry_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {driftSites.map((s, i) => {
                const name = (s.domain ?? s.name ?? "") as string
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span dir="ltr" className="font-mono">
                      {name}
                    </span>
                    <RequireRouteWrite>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          create.mutate({ domain: name })
                        }}
                        disabled={create.isPending}
                      >
                        {t("add")}
                      </Button>
                    </RequireRouteWrite>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {driftSites.length === 0 && !isLoading && sites.length > 0 && (
        <p className="text-muted-foreground text-sm px-1">{t("registry_empty")}</p>
      )}

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
                  aliases: editAliases || null,
                  hosting_account_id: editAccountId ? Number(editAccountId) : null,
                },
              })
            }}
          >
            <div className="space-y-2">
              <Label>{t("field_aliases")}</Label>
              <Input
                dir="ltr"
                value={editAliases}
                onChange={(e) => setEditAliases(e.target.value)}
                placeholder="www.example.com example.net"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("field_hosting_account")}</Label>
              <select
                value={editAccountId}
                onChange={(e) => setEditAccountId(e.target.value)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
              >
                <option value="">{t("no_account")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username}
                    {a.primary_domain ? ` (${a.primary_domain})` : ""}
                  </option>
                ))}
              </select>
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
