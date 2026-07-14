"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type PoolRow = {
  id: number
  name: string
  domain: string | null
  php_version: string
  status: string
  settings?: Record<string, string | number>
}

type Tab = "pools" | "ini" | "extensions"

type PoolEditForm = {
  domain: string
  php_version: string
  pm_max_children: string
  pm_start_servers: string
  memory_limit: string
  upload_max_filesize: string
}

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

function poolToEditForm(pool: PoolRow): PoolEditForm {
  const settings = pool.settings ?? {}
  return {
    domain: pool.domain ?? "",
    php_version: pool.php_version,
    pm_max_children: settings["pm.max_children"] != null ? String(settings["pm.max_children"]) : "",
    pm_start_servers:
      settings["pm.start_servers"] != null ? String(settings["pm.start_servers"]) : "",
    memory_limit: settings["memory_limit"] != null ? String(settings["memory_limit"]) : "",
    upload_max_filesize:
      settings["upload_max_filesize"] != null ? String(settings["upload_max_filesize"]) : "",
  }
}

function buildPoolSettings(form: PoolEditForm): Record<string, string | number> {
  const settings: Record<string, string | number> = {}
  if (form.pm_max_children) settings["pm.max_children"] = Number(form.pm_max_children)
  if (form.pm_start_servers) settings["pm.start_servers"] = Number(form.pm_start_servers)
  if (form.memory_limit) settings["memory_limit"] = form.memory_limit
  if (form.upload_max_filesize) settings["upload_max_filesize"] = form.upload_max_filesize
  return settings
}

export default function PhpPage() {
  const { t } = useTranslation(["php", "common"])
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>("pools")
  const [phpVersion, setPhpVersion] = useState("8.3")
  const [editingPool, setEditingPool] = useState<PoolRow | null>(null)
  const [editForm, setEditForm] = useState<PoolEditForm>({
    domain: "",
    php_version: "8.3",
    pm_max_children: "",
    pm_start_servers: "",
    memory_limit: "",
    upload_max_filesize: "",
  })

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

  const invalidatePools = () => qc.invalidateQueries({ queryKey: ["php-pools"] })

  const create = useMutation({
    mutationFn: (body: {
      name: string
      domain?: string
      php_version?: string
      settings?: Record<string, string | number>
    }) => api("/api/v1/php/pools", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("php:pool_created", { defaultValue: "Pool created" }))
      invalidatePools()
    },
    onError: toastMutationError,
  })

  const updatePool = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number
      body: {
        domain: string | null
        php_version: string
        settings: Record<string, string | number>
      }
    }) => api(`/api/v1/php/pools/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      toast.success(t("php:pool_updated", { defaultValue: "Pool updated" }))
      invalidatePools()
      setEditingPool(null)
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/php/pools/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("php:deleted", { defaultValue: "Pool deleted" }))
      invalidatePools()
    },
    onError: toastMutationError,
  })

  const saveIni = useMutation({
    mutationFn: (body: { version: string; content: string }) =>
      api("/api/v1/php/ini", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("php:ini_saved", { defaultValue: "php.ini saved" }))
      qc.invalidateQueries({ queryKey: ["php-ini", phpVersion] })
    },
    onError: toastMutationError,
  })

  const toggleExtension = useMutation({
    mutationFn: (body: { version: string; extension: string; action: "enable" | "disable" }) =>
      api("/api/v1/php/extensions", { method: "POST", json: body }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.action === "enable"
          ? t("php:extension_enabled", { defaultValue: "Extension enabled" })
          : t("php:extension_disabled", { defaultValue: "Extension disabled" }),
      )
    },
    onError: toastMutationError,
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
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPool(p)
                              setEditForm(poolToEditForm(p))
                            }}
                          >
                            {t("common:edit", { defaultValue: "Edit" })}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => remove.mutate(p.id)}
                          >
                            {t("php:delete")}
                          </Button>
                        </div>
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

      <Dialog open={editingPool !== null} onOpenChange={(open) => !open && setEditingPool(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("php:edit_pool", { defaultValue: "Edit pool" })}
              {editingPool ? ` · ${editingPool.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>{t("php:field_domain")}</Label>
              <Input
                value={editForm.domain}
                onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("php:field_version")}</Label>
              <Input
                value={editForm.php_version}
                onChange={(e) => setEditForm({ ...editForm, php_version: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("php:settings_max_children")}</Label>
              <Input
                type="number"
                min={1}
                value={editForm.pm_max_children}
                onChange={(e) => setEditForm({ ...editForm, pm_max_children: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("php:settings_start_servers")}</Label>
              <Input
                type="number"
                min={1}
                value={editForm.pm_start_servers}
                onChange={(e) => setEditForm({ ...editForm, pm_start_servers: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("php:settings_memory_limit")}</Label>
              <Input
                value={editForm.memory_limit}
                onChange={(e) => setEditForm({ ...editForm, memory_limit: e.target.value })}
                placeholder="256M"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("php:settings_upload_max")}</Label>
              <Input
                value={editForm.upload_max_filesize}
                onChange={(e) => setEditForm({ ...editForm, upload_max_filesize: e.target.value })}
                placeholder="64M"
                dir="ltr"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  editingPool &&
                  updatePool.mutate({
                    id: editingPool.id,
                    body: {
                      domain: editForm.domain || null,
                      php_version: editForm.php_version,
                      settings: buildPoolSettings(editForm),
                    },
                  })
                }
                disabled={updatePool.isPending}
              >
                {t("common:save", { defaultValue: "Save" })}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingPool(null)}>
                {t("common:cancel", { defaultValue: "Cancel" })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
