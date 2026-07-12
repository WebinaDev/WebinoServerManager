"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type VhostRow = {
  id: number
  fqdn: string
  config_name: string
  document_root: string
  php_pool: string | null
  ssl_enabled: boolean
  force_https: boolean
  hsts: boolean
  status: string
}

export default function VhostsPage() {
  const { t } = useTranslation(["webserver", "common"])
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["vhosts"],
    queryFn: () => api<{ vhosts: VhostRow[] }>("/api/v1/webserver/vhosts"),
  })

  const create = useMutation({
    mutationFn: (body: { fqdn: string; document_root?: string; php_pool?: string }) =>
      api("/api/v1/webserver/vhosts", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vhosts"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/webserver/vhosts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vhosts"] }),
  })

  const enableSsl = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/webserver/vhosts/${id}/ssl`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vhosts"] }),
  })

  const enableHsts = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/webserver/vhosts/${id}/hsts`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vhosts"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("webserver:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                fqdn: String(fd.get("fqdn") ?? ""),
                document_root: String(fd.get("document_root") ?? "") || undefined,
                php_pool: String(fd.get("php_pool") ?? "") || undefined,
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="fqdn">{t("webserver:field_fqdn")}</Label>
              <Input id="fqdn" name="fqdn" required dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_root">{t("webserver:field_docroot")}</Label>
              <Input id="document_root" name="document_root" dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="php_pool">{t("webserver:field_php_pool")}</Label>
              <Input id="php_pool" name="php_pool" dir="ltr" className="font-mono" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending}>
                {t("webserver:add")}
              </Button>
            </div>
          </form>

          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.vhosts ?? []).map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/webserver/vhosts/${v.id}`}
                      className="font-medium font-mono hover:underline"
                      dir="ltr"
                    >
                      {v.fqdn}
                    </Link>
                    <p className="text-muted-foreground text-xs font-mono" dir="ltr">
                      {v.document_root}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">{v.status}</span>
                    {v.ssl_enabled ? (
                      <span className="text-xs">SSL</span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={enableSsl.isPending}
                        onClick={() => enableSsl.mutate(v.id)}
                      >
                        {t("webserver:enable_ssl")}
                      </Button>
                    )}
                    {!v.hsts ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={enableHsts.isPending}
                        onClick={() => enableHsts.mutate(v.id)}
                      >
                        {t("webserver:enable_hsts")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(v.id)}
                    >
                      {t("webserver:delete")}
                    </Button>
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
