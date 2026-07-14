"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

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

  const domains = data?.domains ?? []

  const create = useMutation({
    mutationFn: (body: { domain: string; slug?: string }) =>
      api("/api/v1/domains", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success(t("domains:add"))
      qc.invalidateQueries({ queryKey: ["domains"] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("domains:delete"))
      qc.invalidateQueries({ queryKey: ["domains"] })
    },
    onError: toastMutationError,
  })

  const columns: DataTableColumn<DomainRow>[] = [
    {
      id: "domain",
      header: t("domains:field_domain"),
      sortValue: (row) => row.domain,
      cell: (d) => <span dir="ltr">{d.domain}</span>,
    },
    {
      id: "status",
      header: t("common:status", { defaultValue: "Status" }),
      sortValue: (row) => row.status,
      cell: (d) => <span className="text-muted-foreground">{d.status}</span>,
    },
    {
      id: "actions",
      header: t("common:actions", { defaultValue: "Actions" }),
      cell: (d) => (
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
      ),
    },
  ]

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
          <DataTable
            columns={columns}
            data={domains}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("domains:search", { defaultValue: "Search domains…" })}
            searchFilter={(row, q) =>
              row.domain.toLowerCase().includes(q) || row.status.toLowerCase().includes(q)
            }
            emptyMessage={t("domains:empty", { defaultValue: "No domains yet." })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
