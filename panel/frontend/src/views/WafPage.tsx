"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

type WafData = {
  enabled?: boolean
  conf?: string
}

export default function WafPage() {
  const { t } = useTranslation(["security", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["waf"],
    queryFn: () => api<WafData>("/api/v1/security/waf"),
  })

  const mutate = useMutation({
    mutationFn: (enabled: boolean) =>
      api("/api/v1/security/waf", { method: "POST", json: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waf"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("security:waf_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{t("security:waf_description")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("security:firewall_status")}:{" "}
                  {data?.enabled ? t("security:enabled") : t("security:disabled")}
                </span>
                {data?.conf ? (
                  <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                    {data.conf}
                  </span>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutate.isPending || data?.enabled}
                  onClick={() => mutate.mutate(true)}
                >
                  {t("security:waf_enable")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutate.isPending || !data?.enabled}
                  onClick={() => mutate.mutate(false)}
                >
                  {t("security:waf_disable")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
