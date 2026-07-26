"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toastMutationError } from "@/lib/toast"

type WafData = {
  enabled?: boolean
  conf?: string
}

type SiteRow = { name: string; enabled: boolean }

export default function WafPage() {
  const t = useTranslations("security")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["waf"],
    queryFn: () => api<WafData>("/api/v1/security/waf"),
  })

  const sites = useQuery({
    queryKey: ["waf-sites"],
    queryFn: () => api<{ sites: SiteRow[] }>("/api/v1/security/waf/sites"),
  })

  const logs = useQuery({
    queryKey: ["waf-logs"],
    queryFn: () => api<{ logs?: string }>("/api/v1/security/waf/logs"),
  })

  const mutate = useMutation({
    mutationFn: (enabled: boolean) =>
      api("/api/v1/security/waf", { method: "POST", json: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waf"] }),
    onError: toastMutationError,
  })

  const siteMutate = useMutation({
    mutationFn: (body: { name: string; enabled: boolean }) =>
      api("/api/v1/security/waf/sites", { method: "POST", json: body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["waf-sites"] }),
    onError: toastMutationError,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("waf_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{t("waf_description")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("firewall_status")}:{" "}
                  {data?.enabled ? t("enabled") : t("disabled")}
                </span>
                <RequireRouteWrite>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutate.isPending || data?.enabled}
                    onClick={() => mutate.mutate(true)}
                  >
                    {t("waf_enable")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutate.isPending || !data?.enabled}
                    onClick={() => mutate.mutate(false)}
                  >
                    {t("waf_disable")}
                  </Button>
                </RequireRouteWrite>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("waf_sites_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(sites.data?.sites ?? []).map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-2 border-b py-2 text-sm">
              <span className="font-mono text-xs" dir="ltr">
                {s.name}
              </span>
              <RequireRouteWrite>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={siteMutate.isPending}
                  onClick={() => siteMutate.mutate({ name: s.name, enabled: !s.enabled })}
                >
                  {s.enabled ? t("waf_disable") : t("waf_enable")}
                </Button>
              </RequireRouteWrite>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("waf_logs_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted max-h-80 overflow-auto rounded p-3 text-xs" dir="ltr">
            {logs.data?.logs || t("waf_logs_empty")}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
