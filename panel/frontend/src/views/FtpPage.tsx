"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  quota_mb: number | null
  enabled: boolean
  status: string
}

type FtpService = {
  passive_port_range: string
  control_port: number
  log_source: string
  note: string
}

export default function FtpPage() {
  const t = useTranslations("ftp")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const usernameFilter = searchParams.get("username") ?? ""
  const [passwordAccount, setPasswordAccount] = useState<FtpRow | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const { data, isLoading } = useQuery({
    queryKey: ["ftp-accounts"],
    queryFn: () => api<{ accounts: FtpRow[] }>("/api/v1/ftp/accounts"),
  })

  const { data: serviceData } = useQuery({
    queryKey: ["ftp-service"],
    queryFn: () => api<{ service: FtpService }>("/api/v1/ftp/service"),
  })

  const accounts = data?.accounts ?? []

  const create = useMutation({
    mutationFn: (body: {
      username: string
      password: string
      home_dir: string
      domain?: string
      quota_mb?: number
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

  const setQuota = useMutation({
    mutationFn: ({ id, quota_mb }: { id: number; quota_mb: number }) =>
      api(`/api/v1/ftp/accounts/${id}/quota`, { method: "PATCH", json: { quota_mb } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ftp-accounts"] }),
    onError: toastMutationError,
  })

  const changePassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api(`/api/v1/ftp/accounts/${id}/password`, { method: "PATCH", json: { password } }),
    onSuccess: () => {
      toast.success(t("password_updated"))
      setPasswordAccount(null)
      setNewPassword("")
    },
    onError: toastMutationError,
  })

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api(`/api/v1/ftp/accounts/${id}/enabled`, { method: "PATCH", json: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ftp-accounts"] }),
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
      id: "quota",
      header: t("field_quota"),
      sortValue: (row) => row.quota_mb ?? 0,
      cell: (a) => (
        <RequireRouteWrite>
          <Input
            className="h-8 w-24 font-mono"
            defaultValue={a.quota_mb ?? ""}
            dir="ltr"
            placeholder="MB"
            onBlur={(e) => {
              const val = Number(e.target.value)
              if (!Number.isNaN(val) && val >= 0) {
                setQuota.mutate({ id: a.id, quota_mb: val })
              }
            }}
          />
        </RequireRouteWrite>
      ),
    },
    {
      id: "enabled",
      header: t("field_enabled"),
      cell: (a) => (
        <RequireRouteWrite>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleEnabled.mutate({ id: a.id, enabled: !a.enabled })}
          >
            {a.enabled ? t("enabled") : t("disabled")}
          </Button>
        </RequireRouteWrite>
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPasswordAccount(a)}
            >
              {t("change_password")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => remove.mutate(a.id)}
            >
              {t("delete")}
            </Button>
          </div>
        </RequireRouteWrite>
      ),
    },
  ]

  const service = serviceData?.service

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {service ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("service_title")}</CardTitle>
            <CardDescription>{service.note}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm" dir="ltr">
            <p>{t("passive_ports")}: {service.passive_port_range}</p>
            <p>{t("control_port")}: {service.control_port}</p>
            <p>{t("log_source")}: {service.log_source}</p>
            <Button type="button" variant="link" className="h-auto p-0" asChild>
              <Link href="/monitoring/logs">{t("view_transfer_logs")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
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
                const quotaRaw = String(fd.get("quota_mb") ?? "")
                create.mutate({
                  username: String(fd.get("username") ?? ""),
                  password: String(fd.get("password") ?? ""),
                  home_dir: String(fd.get("home_dir") ?? ""),
                  domain: String(fd.get("domain") ?? "") || undefined,
                  quota_mb: quotaRaw ? Number(quotaRaw) : undefined,
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
              <div className="space-y-2">
                <Label htmlFor="quota_mb">{t("field_quota")}</Label>
                <Input id="quota_mb" name="quota_mb" type="number" min={0} dir="ltr" />
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
            initialSearch={usernameFilter}
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
      {passwordAccount ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("change_password")} — {passwordAccount.username}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("field_password")}
            />
            <Button
              type="button"
              disabled={newPassword.length < 8 || changePassword.isPending}
              onClick={() =>
                changePassword.mutate({ id: passwordAccount.id, password: newPassword })
              }
            >
              {t("change_password")}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
