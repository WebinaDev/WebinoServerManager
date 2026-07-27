"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type PanelSettings = {
  settings: {
    bind_domain: string | null
    http_port: number
    https_port: number
    ssl_enabled: boolean
  }
  version?: {
    panel?: string
    name?: string
  }
  links: {
    profile: string
    two_factor: string
    api_tokens: string
    firewall?: string
  }
}

export default function SettingsPage() {
  const t = useTranslations("panelSettings")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [bindDomain, setBindDomain] = useState("")
  const [httpPort, setHttpPort] = useState("2090")
  const [httpsPort, setHttpsPort] = useState("2090")
  const [sslEnabled, setSslEnabled] = useState(false)
  const [rebootToken, setRebootToken] = useState("")
  const [repairReport, setRepairReport] = useState<Record<string, string> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["panel-settings"],
    queryFn: () => api<PanelSettings>("/api/v1/panel/settings"),
  })

  useEffect(() => {
    if (!data?.settings) return
    setBindDomain(data.settings.bind_domain ?? "")
    setHttpPort(String(data.settings.http_port))
    setHttpsPort(String(data.settings.https_port))
    setSslEnabled(data.settings.ssl_enabled)
  }, [data])

  const saveNetwork = useMutation({
    mutationFn: () =>
      api("/api/v1/panel/settings/network", {
        method: "PATCH",
        json: {
          bind_domain: bindDomain || null,
          http_port: Number(httpPort),
          https_port: Number(httpsPort),
          ssl_enabled: sslEnabled,
        },
      }),
    onSuccess: () => {
      toast.success(t("network_saved"))
      qc.invalidateQueries({ queryKey: ["panel-settings"] })
    },
    onError: toastMutationError,
  })

  const restartPanel = useMutation({
    mutationFn: () =>
      api("/api/v1/panel/restart", { method: "POST", json: { confirm: "RESTART" } }),
    onSuccess: () => toast.success(t("restart_started")),
    onError: toastMutationError,
  })

  const requestReboot = useMutation({
    mutationFn: () => api<{ confirm_token: string }>("/api/v1/panel/reboot/confirm", { method: "POST" }),
    onSuccess: (res) => {
      setRebootToken(res.confirm_token)
      toast.success(t("reboot_token_ready"))
    },
    onError: toastMutationError,
  })

  const rebootOs = useMutation({
    mutationFn: () =>
      api("/api/v1/panel/reboot", { method: "POST", json: { confirm_token: rebootToken } }),
    onSuccess: () => toast.success(t("reboot_started")),
    onError: toastMutationError,
  })

  const repair = useMutation({
    mutationFn: () => api<{ report: Record<string, string> }>("/api/v1/panel/repair", { method: "POST", json: {} }),
    onSuccess: (res) => {
      setRepairReport(res.report ?? null)
      toast.success(t("repair_started"))
    },
    onError: toastMutationError,
  })

  if (isLoading) {
    return <p className="p-6">{tCommon("loading")}</p>
  }

  const links = data?.links

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("hub_title")}</CardTitle>
          <CardDescription>{t("hub_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {t("panel_version")}:{" "}
            <span className="font-mono" dir="ltr">
              {data?.version?.name ?? "WebinoServer"} {data?.version?.panel ?? "—"}
            </span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={links?.profile ?? "/profile"}>{t("link_profile")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={links?.two_factor ?? "/security/2fa"}>{t("link_2fa")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={links?.api_tokens ?? "/api-tokens"}>{t("link_tokens")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={links?.firewall ?? "/security/firewall"}>{t("link_firewall")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <RequireRouteWrite>
        <Card>
          <CardHeader>
            <CardTitle>{t("network_title")}</CardTitle>
            <CardDescription>{t("network_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bind_domain">{t("bind_domain")}</Label>
              <Input
                id="bind_domain"
                value={bindDomain}
                onChange={(e) => setBindDomain(e.target.value)}
                dir="ltr"
                placeholder="panel.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="http_port">{t("http_port")}</Label>
              <Input id="http_port" value={httpPort} onChange={(e) => setHttpPort(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="https_port">{t("https_port")}</Label>
              <Input id="https_port" value={httpsPort} onChange={(e) => setHttpsPort(e.target.value)} dir="ltr" />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={sslEnabled}
                onChange={(e) => setSslEnabled(e.target.checked)}
              />
              {t("ssl_enabled")}
            </label>
            <div className="md:col-span-2">
              <Button type="button" onClick={() => saveNetwork.mutate(undefined)} disabled={saveNetwork.isPending}>
                {tCommon("save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("maintenance_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => restartPanel.mutate(undefined)}
                disabled={restartPanel.isPending}
              >
                {t("restart_panel")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => requestReboot.mutate(undefined)}
                disabled={requestReboot.isPending}
              >
                {t("request_reboot_token")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => rebootOs.mutate(undefined)}
                disabled={!rebootToken || rebootOs.isPending}
              >
                {t("reboot_os")}
              </Button>
              <Button type="button" onClick={() => repair.mutate(undefined)} disabled={repair.isPending}>
                {t("repair_panel")}
              </Button>
            </div>
            {rebootToken ? (
              <p className="text-muted-foreground text-sm" dir="ltr">
                {t("reboot_token")}: <code>{rebootToken}</code>
              </p>
            ) : null}
            {repairReport ? (
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs" dir="ltr">
                {JSON.stringify(repairReport, null, 2)}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      </RequireRouteWrite>
    </div>
  )
}
