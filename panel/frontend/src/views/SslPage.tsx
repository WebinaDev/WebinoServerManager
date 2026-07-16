"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { useLocale } from "@/hooks/useLocale"
import { api } from "@/lib/api"

type CertRow = {
  id: number
  domain: string
  type?: string
  issuer: string | null
  status: string
  expires_at: string | null
  auto_renew?: boolean
  alert_days?: number
  service_binding?: string | null
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const ms = new Date(date).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export default function SslPage() {
  const t = useTranslations("ssl")
  const tCommon = useTranslations("common")
  const { formatDateTime } = useLocale()
  const qc = useQueryClient()
  const [validation, setValidation] = useState<{ valid?: string; error?: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["ssl-certificates"],
    queryFn: () => api<{ certificates: CertRow[] }>("/api/v1/ssl/certificates"),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ssl-certificates"] })

  const issue = useMutation({
    mutationFn: (domain: string) =>
      api("/api/v1/ssl/certificates", { method: "POST", json: { domain } }),
    onSuccess: invalidate,
  })

  const issueWildcard = useMutation({
    mutationFn: (domain: string) =>
      api("/api/v1/ssl/certificates/wildcard", { method: "POST", json: { domain } }),
    onSuccess: invalidate,
  })

  const renew = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/ssl/certificates/${id}/renew`, { method: "POST" }),
    onSuccess: invalidate,
  })

  const upload = useMutation({
    mutationFn: (body: { domain: string; cert_pem: string; key_pem: string; chain_pem?: string }) =>
      api("/api/v1/ssl/certificates/upload", { method: "POST", json: body }),
    onSuccess: invalidate,
  })

  const validateChain = useMutation({
    mutationFn: (body: { cert_pem: string; key_pem: string; chain_pem?: string }) =>
      api<{ validation: { valid?: string; error?: string } }>("/api/v1/ssl/validate-chain", {
        method: "POST",
        json: body,
      }),
    onSuccess: (res) => setValidation(res.validation),
  })

  const bindService = useMutation({
    mutationFn: ({ id, service }: { id: number; service: string }) =>
      api(`/api/v1/ssl/certificates/${id}/bind`, { method: "POST", json: { service } }),
    onSuccess: invalidate,
  })

  const updateCert = useMutation({
    mutationFn: ({ id, ...body }: { id: number; auto_renew?: boolean; alert_days?: number }) =>
      api(`/api/v1/ssl/certificates/${id}`, { method: "PATCH", json: body }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/ssl/certificates/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="flex flex-col gap-3 md:flex-row md:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                issue.mutate(String(fd.get("domain") ?? ""))
                e.currentTarget.reset()
              }}
            >
              <div className="grow space-y-2">
                <Label htmlFor="domain">{t("field_domain")}</Label>
                <Input id="domain" name="domain" required dir="ltr" />
              </div>
              <Button type="submit" disabled={issue.isPending}>
                {t("issue")}
              </Button>
            </form>

            <form
              className="flex flex-col gap-3 md:flex-row md:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                issueWildcard.mutate(String(fd.get("wildcard_domain") ?? ""))
                e.currentTarget.reset()
              }}
            >
              <div className="grow space-y-2">
                <Label htmlFor="wildcard_domain">{t("wildcard_domain")}</Label>
                <Input id="wildcard_domain" name="wildcard_domain" required dir="ltr" placeholder="example.com" />
              </div>
              <Button type="submit" variant="outline" disabled={issueWildcard.isPending}>
                {t("issue_wildcard")}
              </Button>
            </form>
          </RequireRouteWrite>

          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.certificates ?? []).map((c) => {
                const days = daysUntil(c.expires_at)
                return (
                  <li key={c.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span dir="ltr" className="font-mono font-medium">
                        {c.domain}
                        {c.type ? ` (${c.type})` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {c.status}
                        {days !== null ? ` · ${days}d` : ""}
                        {c.expires_at ? ` · ${t("expires")}: ${formatDateTime(c.expires_at)}` : ""}
                      </span>
                    </div>
                    <RequireRouteWrite>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={renew.isPending} onClick={() => renew.mutate(c.id)}>
                          {t("renew")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => bindService.mutate({ id: c.id, service: "panel" })}
                        >
                          {t("bind_panel")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => bindService.mutate({ id: c.id, service: "mail" })}
                        >
                          {t("bind_mail")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => remove.mutate(c.id)}>
                          {t("delete")}
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            defaultChecked={c.auto_renew ?? true}
                            onChange={(e) =>
                              updateCert.mutate({ id: c.id, auto_renew: e.target.checked })
                            }
                          />
                          {t("auto_renew")}
                        </label>
                        <label className="flex items-center gap-2">
                          {t("alert_days")}
                          <Input
                            type="number"
                            className="h-7 w-16"
                            defaultValue={c.alert_days ?? 14}
                            onBlur={(e) =>
                              updateCert.mutate({ id: c.id, alert_days: Number(e.target.value) })
                            }
                          />
                        </label>
                        {c.service_binding ? (
                          <span>{t("bound_to")}: {c.service_binding}</span>
                        ) : null}
                      </div>
                    </RequireRouteWrite>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("upload_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RequireRouteWrite>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                upload.mutate({
                  domain: String(fd.get("upload_domain")),
                  cert_pem: String(fd.get("cert_pem")),
                  key_pem: String(fd.get("key_pem")),
                  chain_pem: String(fd.get("chain_pem") ?? "") || undefined,
                })
              }}
            >
            <div className="space-y-2">
              <Label htmlFor="upload_domain">{t("field_domain")}</Label>
              <Input id="upload_domain" name="upload_domain" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert_pem">{t("cert_pem")}</Label>
              <textarea id="cert_pem" name="cert_pem" required className="border-input min-h-24 w-full rounded-md border p-2 font-mono text-xs" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key_pem">{t("key_pem")}</Label>
              <textarea id="key_pem" name="key_pem" required className="border-input min-h-24 w-full rounded-md border p-2 font-mono text-xs" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chain_pem">{t("chain_pem")}</Label>
              <textarea id="chain_pem" name="chain_pem" className="border-input min-h-16 w-full rounded-md border p-2 font-mono text-xs" dir="ltr" />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const form = document.getElementById("cert_pem") as HTMLTextAreaElement
                  const key = document.getElementById("key_pem") as HTMLTextAreaElement
                  const chain = document.getElementById("chain_pem") as HTMLTextAreaElement
                  validateChain.mutate({
                    cert_pem: form?.value ?? "",
                    key_pem: key?.value ?? "",
                    chain_pem: chain?.value ?? "",
                  })
                }}
              >
                {t("validate_chain")}
              </Button>
              <Button type="submit" disabled={upload.isPending}>
                {t("upload")}
              </Button>
            </div>
            {validation ? (
              <p className={validation.valid === "true" ? "text-green-600 text-sm" : "text-destructive text-sm"}>
                {validation.valid === "true" ? t("chain_valid") : validation.error ?? t("chain_invalid")}
              </p>
            ) : null}
            </form>
          </RequireRouteWrite>
        </CardContent>
      </Card>
    </div>
  )
}
