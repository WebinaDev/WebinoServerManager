"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type FtpRow = {
  id: number
  username: string
  home_dir: string
  domain: string | null
  status: string
}

export default function FtpPage() {
  const t = useTranslations("ftp")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["ftp-accounts"],
    queryFn: () => api<{ accounts: FtpRow[] }>("/api/v1/ftp/accounts"),
  })

  const accounts = data?.accounts ?? []

  const create = useMutation({
    mutationFn: (body: {
      username: string
      password: string
      home_dir: string
      domain?: string
    }) => api("/api/v1/ftp/accounts", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("add"))
      qc.invalidateQueries({ queryKey: ["ftp-accounts"] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/ftp/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete"))
      qc.invalidateQueries({ queryKey: ["ftp-accounts"] })
    },
    onError: toastMutationError,
  })

  const columns: DataTableColumn<FtpRow>[] = [
    {
      id: "username",
      header: t("field_username"),
      sortValue: (row) => row.username,
      cell: (a) => (
        <span dir="ltr">
          {a.username} → {a.home_dir}
        </span>
      ),
    },
    {
      id: "domain",
      header: t("field_domain"),
      sortValue: (row) => row.domain ?? "",
      cell: (a) => (
        <span className="text-muted-foreground" dir="ltr">
          {a.domain ?? tCommon("em_dash")}
        </span>
      ),
    },
    {
      id: "status",
      header: t("status"),
      sortValue: (row) => row.status,
      cell: (a) => <span className="text-muted-foreground">{a.status}</span>,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: (a) => (
        <RequireRouteWrite>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => remove.mutate(a.id)}
          >
            {t("delete")}
          </Button>
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
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate({
                  username: String(fd.get("username") ?? ""),
                  password: String(fd.get("password") ?? ""),
                  home_dir: String(fd.get("home_dir") ?? ""),
                  domain: String(fd.get("domain") ?? "") || undefined,
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="username">{t("field_username")}</Label>
                <Input id="username" name="username" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("field_password")}</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home_dir">{t("field_home")}</Label>
                <Input id="home_dir" name="home_dir" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">{t("field_domain")}</Label>
                <Input id="domain" name="domain" dir="ltr" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  {t("add")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>
          <DataTable
            columns={columns}
            data={accounts}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("search")}
            searchFilter={(row, q) =>
              row.username.toLowerCase().includes(q) ||
              row.home_dir.toLowerCase().includes(q) ||
              (row.domain ?? "").toLowerCase().includes(q)
            }
            emptyMessage={t("empty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
