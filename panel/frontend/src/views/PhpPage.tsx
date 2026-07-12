"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type PoolRow = {
  id: number
  name: string
  domain: string | null
  php_version: string
  status: string
}

type Tab = "pools" | "ini" | "extensions"

const EXTENSIONS = [
  "bcmath",
  "curl",
  "gd",
  "intl",
  "mbstring",
  "mysql",
  "opcache",
  "pgsql",
  "readline",
  "soap",
  "sqlite3",
  "xml",
  "zip",
]

export default function PhpPage() {
  const { t } = useTranslation(["php", "common"])
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>("pools")
  const [phpVersion, setPhpVersion] = useState("8.3")

  const { data, isLoading } = useQuery({
    queryKey: ["php-pools"],
    queryFn: () => api<{ pools: PoolRow[] }>("/api/v1/php/pools"),
    enabled: tab === "pools",
  })

  const ini = useQuery({
    queryKey: ["php-ini", phpVersion],
    queryFn: () => api<{ version: string; content: string }>(`/api/v1/php/ini?version=${phpVersion}`),
    enabled: tab === "ini",
  })

  const create = useMutation({
    mutationFn: (body: {
      name: string
      domain?: string
      php_version?: string
      settings?: Record<string, string | number>
    }) => api("/api/v1/php/pools", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["php-pools"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/php/pools/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["php-pools"] }),
  })

  const saveIni = useMutation({
    mutationFn: (body: { version: string; content: string }) =>
      api("/api/v1/php/ini", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["php-ini", phpVersion] }),
  })

  const toggleExtension = useMutation({
    mutationFn: (body: { version: string; extension: string; action: "enable" | "disable" }) =>
      api("/api/v1/php/extensions", { method: "POST", json: body }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("php:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "pools" ? "default" : "outline"}
              onClick={() => setTab("pools")}
            >
              {t("php:tab_pools")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "ini" ? "default" : "outline"}
              onClick={() => setTab("ini")}
            >
              {t("php:tab_ini")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "extensions" ? "default" : "outline"}
              onClick={() => setTab("extensions")}
            >
              {t("php:tab_extensions")}
            </Button>
          </div>

          {tab === "pools" && (
            <>
              <RequireRouteWrite>
                <form
                  className="grid gap-3 md:grid-cols-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    const settings: Record<string, string | number> = {}
                    const maxChildren = fd.get("pm_max_children")
                    const startServers = fd.get("pm_start_servers")
                    const memoryLimit = fd.get("memory_limit")
                    const uploadMax = fd.get("upload_max_filesize")
                    if (maxChildren) settings["pm.max_children"] = Number(maxChildren)
                    if (startServers) settings["pm.start_servers"] = Number(startServers)
                    if (memoryLimit) settings["memory_limit"] = String(memoryLimit)
                    if (uploadMax) settings["upload_max_filesize"] = String(uploadMax)

                    create.mutate({
                      name: String(fd.get("name") ?? ""),
                      domain: String(fd.get("domain") ?? "") || undefined,
                      php_version: String(fd.get("php_version") ?? "") || undefined,
                      settings: Object.keys(settings).length ? settings : undefined,
                    })
                    e.currentTarget.reset()
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("php:field_name")}</Label>
                    <Input id="name" name="name" required dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="domain">{t("php:field_domain")}</Label>
                    <Input id="domain" name="domain" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="php_version">{t("php:field_version")}</Label>
                    <Input id="php_version" name="php_version" defaultValue="8.3" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pm_max_children">{t("php:settings_max_children")}</Label>
                    <Input id="pm_max_children" name="pm_max_children" type="number" min={1} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pm_start_servers">{t("php:settings_start_servers")}</Label>
                    <Input id="pm_start_servers" name="pm_start_servers" type="number" min={1} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memory_limit">{t("php:settings_memory_limit")}</Label>
                    <Input id="memory_limit" name="memory_limit" placeholder="256M" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload_max_filesize">{t("php:settings_upload_max")}</Label>
                    <Input id="upload_max_filesize" name="upload_max_filesize" placeholder="64M" dir="ltr" />
                  </div>
                  <div className="md:col-span-3">
                    <Button type="submit" disabled={create.isPending}>
                      {t("php:add")}
                    </Button>
                  </div>
                </form>
              </RequireRouteWrite>
              {isLoading ? (
                <p>{t("common:loading")}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {(data?.pools ?? []).map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <span dir="ltr">
                        {p.name} (PHP {p.php_version})
                        {p.domain ? ` · ${p.domain}` : ""}
                      </span>
                      <span className="text-muted-foreground">{p.status}</span>
                      <RequireRouteWrite>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => remove.mutate(p.id)}
                        >
                          {t("php:delete")}
                        </Button>
                      </RequireRouteWrite>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "ini" && (
            <div className="space-y-3">
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="ini-version">{t("php:field_version")}</Label>
                <Input
                  id="ini-version"
                  value={phpVersion}
                  onChange={(e) => setPhpVersion(e.target.value)}
                  dir="ltr"
                />
              </div>
              {ini.isLoading ? (
                <p>{t("common:loading")}</p>
              ) : (
                <RequireRouteWrite>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const fd = new FormData(e.currentTarget)
                      saveIni.mutate({
                        version: phpVersion,
                        content: String(fd.get("content") ?? ""),
                      })
                    }}
                  >
                    <textarea
                      name="content"
                      key={ini.data?.content ?? ""}
                      defaultValue={ini.data?.content ?? ""}
                      dir="ltr"
                      className="border-input bg-background min-h-80 w-full rounded-md border px-3 py-2 font-mono text-sm"
                    />
                    <Button type="submit" disabled={saveIni.isPending}>
                      {t("php:ini_save")}
                    </Button>
                  </form>
                </RequireRouteWrite>
              )}
            </div>
          )}

          {tab === "extensions" && (
            <div className="space-y-3">
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="ext-version">{t("php:field_version")}</Label>
                <Input
                  id="ext-version"
                  value={phpVersion}
                  onChange={(e) => setPhpVersion(e.target.value)}
                  dir="ltr"
                />
              </div>
              <ul className="divide-y rounded-md border">
                {EXTENSIONS.map((ext) => (
                  <li
                    key={ext}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
                    dir="ltr"
                  >
                    <span>{ext}</span>
                    <RequireRouteWrite>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={toggleExtension.isPending}
                          onClick={() =>
                            toggleExtension.mutate({
                              version: phpVersion,
                              extension: ext,
                              action: "enable",
                            })
                          }
                        >
                          {t("php:extension_enable")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={toggleExtension.isPending}
                          onClick={() =>
                            toggleExtension.mutate({
                              version: phpVersion,
                              extension: ext,
                              action: "disable",
                            })
                          }
                        >
                          {t("php:extension_disable")}
                        </Button>
                      </div>
                    </RequireRouteWrite>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
