"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toastMutationError } from "@/lib/toast"

type RiskCheck = {
  id: number
  check_id: string
  status: string
  fixable: boolean
  title: string | null
}

export default function SecurityRisksPage() {
  const t = useTranslations("security")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["security-risks"],
    queryFn: () => api<{ checks: RiskCheck[] }>("/api/v1/security/risks"),
  })

  const fix = useMutation({
    mutationFn: (id: string) =>
      api("/api/v1/security/risks/fix", { method: "POST", json: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security-risks"] }),
    onError: toastMutationError,
  })

  const ignore = useMutation({
    mutationFn: (id: string) =>
      api("/api/v1/security/risks/ignore", { method: "POST", json: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security-risks"] }),
    onError: toastMutationError,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("risks_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">{t("risks_description")}</p>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="space-y-2">
              {(data?.checks ?? []).map((c) => (
                <li
                  key={c.check_id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{c.title ?? c.check_id}</div>
                    <div className="text-muted-foreground font-mono text-xs" dir="ltr">
                      {c.check_id} · {c.status}
                    </div>
                  </div>
                  <RequireRouteWrite>
                    <div className="flex gap-2">
                      {c.fixable && c.status === "fail" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={fix.isPending}
                          onClick={() => fix.mutate(c.check_id)}
                        >
                          {t("risks_fix")}
                        </Button>
                      ) : null}
                      {c.status !== "ignore" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ignore.isPending}
                          onClick={() => ignore.mutate(c.check_id)}
                        >
                          {t("risks_ignore")}
                        </Button>
                      ) : null}
                    </div>
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
