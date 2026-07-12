"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type FtpRow = {
  id: number
  username: string
  home_dir: string
  domain: string | null
  status: string
}

export default function FtpPage() {
  const { t } = useTranslation(["ftp", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["ftp-accounts"],
    queryFn: () => api<{ accounts: FtpRow[] }>("/api/v1/ftp/accounts"),
  })

  const create = useMutation({
    mutationFn: (body: {
      username: string
      password: string
      home_dir: string
      domain?: string
    }) => api("/api/v1/ftp/accounts", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ftp-accounts"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/ftp/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ftp-accounts"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("ftp:title")}</CardTitle>
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
                <Label htmlFor="username">{t("ftp:field_username")}</Label>
                <Input id="username" name="username" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("ftp:field_password")}</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home_dir">{t("ftp:field_home")}</Label>
                <Input id="home_dir" name="home_dir" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">{t("ftp:field_domain")}</Label>
                <Input id="domain" name="domain" dir="ltr" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  {t("ftp:add")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.accounts ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span dir="ltr">
                    {a.username} → {a.home_dir}
                  </span>
                  <span className="text-muted-foreground">{a.status}</span>
                  <RequireRouteWrite>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove.mutate(a.id)}
                    >
                      {t("ftp:delete")}
                    </Button>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
