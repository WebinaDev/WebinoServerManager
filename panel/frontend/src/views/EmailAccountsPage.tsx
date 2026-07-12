"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

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
  const { data, isLoading } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () =>
      api<{ accounts: MailAccount[] }>("/api/v1/email/accounts"),
  })

  const create = useMutation({
    mutationFn: (body: {
      address: string
      password: string
      quota_mb?: number
    }) => api("/api/v1/email/accounts", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-accounts"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/email/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-accounts"] }),
  })

  const changePassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api(`/api/v1/email/accounts/${id}/password`, {
        method: "PATCH",
        json: { password },
      }),
  })

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
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.accounts ?? []).map((a) => {
                const usage = formatQuotaUsage(a.quota_usage)
                return (
                  <li key={a.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span dir="ltr">{a.address}</span>
                      <span className="text-muted-foreground">
                        {a.quota_mb} MB · {a.status}
                        {usage && (
                          <>
                            {" "}
                            · {t("email:quota_usage")}: <span dir="ltr">{usage}</span>
                          </>
                        )}
                      </span>
                      <RequireRouteWrite>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => remove.mutate(a.id)}
                        >
                          {t("email:delete")}
                        </Button>
                      </RequireRouteWrite>
                    </div>
                    <RequireRouteWrite>
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const fd = new FormData(e.currentTarget)
                          const password = String(fd.get("new_password") ?? "")
                          changePassword.mutate(
                            { id: a.id, password },
                            {
                              onSuccess: () => e.currentTarget.reset(),
                            },
                          )
                        }}
                      >
                        <div className="space-y-1">
                          <Label htmlFor={`pwd-${a.id}`} className="text-xs">
                            {t("email:change_password")}
                          </Label>
                          <Input
                            id={`pwd-${a.id}`}
                            name="new_password"
                            type="password"
                            minLength={8}
                            required
                            className="h-8"
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          disabled={changePassword.isPending}
                        >
                          {t("email:change_password")}
                        </Button>
                      </form>
                    </RequireRouteWrite>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
