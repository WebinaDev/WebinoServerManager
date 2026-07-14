"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

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

type QuotaUsage = {
  used_bytes?: string | number
  limit_bytes?: string | number
  percent?: number
}

type MailAccount = {
  id: number
  address: string
  quota_mb: number
  status: string
  quota_usage?: QuotaUsage
}

function formatQuotaUsage(usage?: QuotaUsage): string | null {
  if (!usage) return null
  const used = usage.used_bytes
  const limit = usage.limit_bytes
  if (used != null && limit != null) {
    return `${used} / ${limit}`
  }
  if (usage.percent != null) {
    return `${usage.percent}%`
  }
  return null
}

export default function EmailAccountsPage() {
  const { t } = useTranslation(["email", "common"])
  const qc = useQueryClient()
  const [passwordTarget, setPasswordTarget] = useState<MailAccount | null>(null)
  const [passwordValue, setPasswordValue] = useState("")
  const [quotaTarget, setQuotaTarget] = useState<MailAccount | null>(null)
  const [quotaValue, setQuotaValue] = useState("1024")
  const { data, isLoading } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () =>
      api<{ accounts: MailAccount[] }>("/api/v1/email/accounts"),
  })

  const accounts = data?.accounts ?? []

  const create = useMutation({
    mutationFn: (body: {
      address: string
      password: string
      quota_mb?: number
    }) => api("/api/v1/email/accounts", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("email:add_account"))
      qc.invalidateQueries({ queryKey: ["email-accounts"] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/email/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("email:delete"))
      qc.invalidateQueries({ queryKey: ["email-accounts"] })
    },
    onError: toastMutationError,
  })

  const changePassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api(`/api/v1/email/accounts/${id}/password`, {
        method: "PATCH",
        json: { password },
      }),
    onSuccess: () => {
      toast.success(t("email:change_password"))
      setPasswordTarget(null)
      setPasswordValue("")
    },
    onError: toastMutationError,
  })

  const updateQuota = useMutation({
    mutationFn: ({ id, quota_mb }: { id: number; quota_mb: number }) =>
      api(`/api/v1/email/accounts/${id}/quota`, {
        method: "PATCH",
        json: { quota_mb },
      }),
    onSuccess: () => {
      toast.success(t("email:quota_updated", { defaultValue: "Quota updated" }))
      setQuotaTarget(null)
      qc.invalidateQueries({ queryKey: ["email-accounts"] })
    },
    onError: toastMutationError,
  })

  const columns: DataTableColumn<MailAccount>[] = [
    {
      id: "address",
      header: t("email:field_address"),
      sortValue: (row) => row.address,
      cell: (a) => <span dir="ltr">{a.address}</span>,
    },
    {
      id: "quota",
      header: t("email:field_quota"),
      sortValue: (row) => row.quota_mb,
      cell: (a) => {
        const usage = formatQuotaUsage(a.quota_usage)
        return (
          <span className="text-muted-foreground">
            {a.quota_mb} MB
            {usage ? (
              <>
                {" "}
                · {t("email:quota_usage")}: <span dir="ltr">{usage}</span>
              </>
            ) : null}
          </span>
        )
      },
    },
    {
      id: "status",
      header: t("email:status"),
      sortValue: (row) => row.status,
      cell: (a) => <span className="text-muted-foreground">{a.status}</span>,
    },
    {
      id: "actions",
      header: t("common:actions", { defaultValue: "Actions" }),
      cell: (a) => (
        <RequireRouteWrite>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPasswordTarget(a)
                setPasswordValue("")
              }}
            >
              {t("email:change_password")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuotaTarget(a)
                setQuotaValue(String(a.quota_mb))
              }}
            >
              {t("email:edit_quota", { defaultValue: "Edit quota" })}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => remove.mutate(a.id)}
            >
              {t("email:delete")}
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
          <CardTitle>{t("email:accounts_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate({
                  address: String(fd.get("address") ?? ""),
                  password: String(fd.get("password") ?? ""),
                  quota_mb: Number(fd.get("quota_mb") ?? 1024),
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="address">{t("email:field_address")}</Label>
                <Input id="address" name="address" type="email" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("email:field_password")}</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quota_mb">{t("email:field_quota")}</Label>
                <Input
                  id="quota_mb"
                  name="quota_mb"
                  type="number"
                  defaultValue={1024}
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-3">
                <Button type="submit" disabled={create.isPending}>
                  {t("email:add_account")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>
          <DataTable
            columns={columns}
            data={accounts}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("email:search_accounts", { defaultValue: "Search accounts…" })}
            searchFilter={(row, q) =>
              row.address.toLowerCase().includes(q) || row.status.toLowerCase().includes(q)
            }
            emptyMessage={t("email:empty_accounts", { defaultValue: "No email accounts yet." })}
          />
        </CardContent>
      </Card>

      <Dialog open={passwordTarget !== null} onOpenChange={(open) => !open && setPasswordTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("email:change_password")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("email:field_password")}</Label>
            <Input
              id="new-password"
              type="password"
              minLength={8}
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={!passwordTarget || passwordValue.length < 8 || changePassword.isPending}
            onClick={() => {
              if (!passwordTarget) return
              changePassword.mutate({ id: passwordTarget.id, password: passwordValue })
            }}
          >
            {t("common:save", { defaultValue: "Save" })}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={quotaTarget !== null} onOpenChange={(open) => !open && setQuotaTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("email:edit_quota", { defaultValue: "Edit quota" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quota-edit">{t("email:field_quota")}</Label>
            <Input
              id="quota-edit"
              type="number"
              min={1}
              dir="ltr"
              value={quotaValue}
              onChange={(e) => setQuotaValue(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={!quotaTarget || updateQuota.isPending}
            onClick={() => {
              if (!quotaTarget) return
              updateQuota.mutate({
                id: quotaTarget.id,
                quota_mb: Number(quotaValue),
              })
            }}
          >
            {t("common:save", { defaultValue: "Save" })}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
