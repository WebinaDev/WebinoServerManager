"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type MailDomain = {
  id: number
  domain: string
  status: string
  dkim_selector?: string | null
}

type DnsChecks = {
  spf: boolean
  dmarc: boolean
  dkim: boolean
}

type GenerateResult = {
  domain: MailDomain
  records: { type: string; name: string; content: string; status: string }[]
  dkim: Record<string, string>
}

export default function EmailAuthPage() {
  const t = useTranslations("email")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [checks, setChecks] = useState<Record<number, DnsChecks>>({})
  const [generated, setGenerated] = useState<Record<number, GenerateResult>>({})

  const { data, isLoading } = useQuery({
    queryKey: ["email-domains"],
    queryFn: () => api<{ domains: MailDomain[] }>("/api/v1/email/domains"),
  })

  const generate = useMutation({
    mutationFn: (id: number) =>
      api<GenerateResult>(`/api/v1/email/domains/${id}/auth/generate`, { method: "POST" }),
    onSuccess: (res, id) => {
      setGenerated((prev) => ({ ...prev, [id]: res }))
      qc.invalidateQueries({ queryKey: ["email-domains"] })
    },
  })

  const validate = useMutation({
    mutationFn: (id: number) =>
      api<{ domain: string; checks: DnsChecks }>(
        `/api/v1/email/domains/${id}/auth/validate`,
      ),
    onSuccess: (res, id) => {
      setChecks((prev) => ({ ...prev, [id]: res.checks }))
    },
  })

  const checkLabel = (ok: boolean) => (ok ? "✓" : "✗")

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("auth_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.domains ?? []).length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">
                  {t("auth_no_domains")}
                </li>
              ) : (
                data!.domains.map((d) => (
                  <li key={d.id} className="space-y-3 px-4 py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium" dir="ltr">
                        {d.domain}
                      </span>
                      <div className="flex flex-wrap gap-2">
                      <RequireRouteWrite>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={generate.isPending}
                          onClick={() => generate.mutate(d.id)}
                        >
                          {t("auth_generate")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={validate.isPending}
                          onClick={() => validate.mutate(d.id)}
                        >
                          {t("auth_validate")}
                        </Button>
                      </RequireRouteWrite>
                      </div>
                    </div>

                    {generated[d.id] && (
                      <div className="bg-muted/50 space-y-2 rounded-md p-3">
                        <p className="text-xs font-medium">{t("auth_records_created")}</p>
                        <ul className="space-y-1 text-xs" dir="ltr">
                          {generated[d.id].records.map((r, i) => (
                            <li key={i}>
                              {r.type} {r.name}: {r.content.slice(0, 80)}
                              {r.content.length > 80 ? "…" : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {checks[d.id] && (
                      <div className="flex flex-wrap gap-4 text-xs" dir="ltr">
                        <span>
                          SPF {checkLabel(checks[d.id].spf)}
                        </span>
                        <span>
                          DKIM {checkLabel(checks[d.id].dkim)}
                        </span>
                        <span>
                          DMARC {checkLabel(checks[d.id].dmarc)}
                        </span>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
