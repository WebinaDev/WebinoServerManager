"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toastMutationError } from "@/lib/toast"

type WafData = {
  enabled?: boolean
  conf?: string
}

type SiteRow = { name: string; enabled: boolean; geo_deny?: string[] }

const GEO_CODES = ["CN", "RU", "KP", "IR", "US", "GB", "DE", "FR", "IN", "BR"]

export default function WafPage() {
  const t = useTranslations("security")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [geoSite, setGeoSite] = useState("")
  const [geoCountries, setGeoCountries] = useState<string[]>([])

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

  const geoMutate = useMutation({
    mutationFn: (body: { name: string; countries: string[] }) =>
      api("/api/v1/security/waf/sites", {
        method: "POST",
        json: { name: body.name, action: "geo_deny", countries: body.countries },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["waf-sites"] })
      setGeoSite("")
      setGeoCountries([])
    },
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
            <div key={s.name} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
              <div>
                <span className="font-mono text-xs" dir="ltr">
                  {s.name}
                </span>
                {(s.geo_deny?.length ?? 0) > 0 ? (
                  <p className="text-muted-foreground text-xs" dir="ltr">
                    {t("waf_geo_active")}: {(s.geo_deny ?? []).join(", ")}
                  </p>
                ) : null}
              </div>
              <RequireRouteWrite>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={siteMutate.isPending}
                    onClick={() => siteMutate.mutate({ name: s.name, enabled: !s.enabled })}
                  >
                    {s.enabled ? t("waf_disable") : t("waf_enable")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setGeoSite(s.name)
                      setGeoCountries(s.geo_deny ?? [])
                    }}
                  >
                    {t("waf_geo_edit")}
                  </Button>
                </div>
              </RequireRouteWrite>
            </div>
          ))}
        </CardContent>
      </Card>

      {geoSite ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("waf_geo_title")} — {geoSite}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">{t("waf_geo_description")}</p>
            <div className="flex flex-wrap gap-2">
              {GEO_CODES.map((code) => {
                const on = geoCountries.includes(code)
                return (
                  <Button
                    key={code}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() =>
                      setGeoCountries((prev) =>
                        on ? prev.filter((c) => c !== code) : [...prev, code],
                      )
                    }
                  >
                    {code}
                  </Button>
                )
              })}
            </div>
            <div className="space-y-2">
              <Label>{t("waf_geo_custom")}</Label>
              <Input
                dir="ltr"
                placeholder="CN,RU"
                value={geoCountries.join(",")}
                onChange={(e) =>
                  setGeoCountries(
                    e.target.value
                      .split(/[\s,]+/)
                      .map((s) => s.trim().toUpperCase())
                      .filter((s) => s.length === 2),
                  )
                }
              />
            </div>
            <RequireRouteWrite>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={geoMutate.isPending}
                  onClick={() =>
                    geoMutate.mutate({ name: geoSite, countries: geoCountries })
                  }
                >
                  {t("waf_geo_save")}
                </Button>
                <Button
                  variant="outline"
                  disabled={geoMutate.isPending}
                  onClick={() => geoMutate.mutate({ name: geoSite, countries: [] })}
                >
                  {t("waf_geo_clear")}
                </Button>
                <Button variant="ghost" onClick={() => setGeoSite("")}>
                  {tCommon("cancel")}
                </Button>
              </div>
            </RequireRouteWrite>
          </CardContent>
        </Card>
      ) : null}

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
