"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type WpRow = {
  id: number
  domain: string
  path: string
  title: string
  admin_user: string
  status: string
  last_error: string | null
}

export default function WordpressPage() {
  const { t } = useTranslation(["wordpress", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["wordpress"],
    queryFn: () => api<{ sites: WpRow[] }>("/api/v1/wordpress"),
  })

  const create = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api("/api/v1/wordpress", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wordpress"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/wordpress/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wordpress"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("wordpress:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                domain: String(fd.get("domain") ?? ""),
                path: String(fd.get("path") ?? ""),
                title: String(fd.get("title") ?? ""),
                admin_user: String(fd.get("admin_user") ?? ""),
                admin_password: String(fd.get("admin_password") ?? ""),
                admin_email: String(fd.get("admin_email") ?? ""),
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="domain">{t("wordpress:field_domain")}</Label>
              <Input id="domain" name="domain" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="path">{t("wordpress:field_path")}</Label>
              <Input id="path" name="path" required dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">{t("wordpress:field_title")}</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_user">{t("wordpress:field_admin_user")}</Label>
              <Input id="admin_user" name="admin_user" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_password">{t("wordpress:field_admin_password")}</Label>
              <Input
                id="admin_password"
                name="admin_password"
                type="password"
                required
                minLength={8}
                dir="ltr"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="admin_email">{t("wordpress:field_admin_email")}</Label>
              <Input id="admin_email" name="admin_email" type="email" dir="ltr" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {t("wordpress:install")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.sites ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-muted-foreground font-mono text-xs" dir="ltr">
                      {s.domain} · {s.path}
                    </p>
                    {s.last_error ? (
                      <p className="text-destructive text-xs">{s.last_error}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{s.status}</span>
                    <RequireRouteWrite>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(s.id)}
                      >
                        {t("wordpress:delete")}
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
