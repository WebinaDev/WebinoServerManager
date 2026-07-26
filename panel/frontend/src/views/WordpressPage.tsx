"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type WpRow = {
  id: number
  domain: string
  path: string
  title: string
  admin_user: string
  status: string
  last_error: string | null
}

type ThemeRow = { name?: string; status?: string; update?: string; version?: string }
type PluginRow = { name?: string; status?: string; update?: string; version?: string }

export default function WordpressPage() {
  const t = useTranslations("wordpress")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cloneTarget, setCloneTarget] = useState("")
  const [migrateOld, setMigrateOld] = useState("")
  const [migrateNew, setMigrateNew] = useState("")
  const [stagingDomain, setStagingDomain] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["wordpress"],
    queryFn: () => api<{ sites: WpRow[] }>("/api/v1/wordpress"),
  })

  const { data: themesData } = useQuery({
    queryKey: ["wordpress-themes", selectedId],
    queryFn: () => api<{ themes: ThemeRow[] }>(`/api/v1/wordpress/${selectedId}/themes`),
    enabled: selectedId !== null,
  })

  const { data: pluginsData } = useQuery({
    queryKey: ["wordpress-plugins", selectedId],
    queryFn: () => api<{ plugins: PluginRow[] }>(`/api/v1/wordpress/${selectedId}/plugins`),
    enabled: selectedId !== null,
  })

  const create = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api("/api/v1/wordpress", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wordpress"] }),
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/wordpress/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wordpress"] })
      setSelectedId(null)
    },
    onError: toastMutationError,
  })

  const cloneSite = useMutation({
    mutationFn: ({ id, target_path }: { id: number; target_path: string }) =>
      api(`/api/v1/wordpress/${id}/clone`, { method: "POST", json: { target_path } }),
    onSuccess: () => toast.success(t("clone_done")),
    onError: toastMutationError,
  })

  const migrateSite = useMutation({
    mutationFn: ({ id, old_url, new_url }: { id: number; old_url: string; new_url: string }) =>
      api(`/api/v1/wordpress/${id}/migrate`, { method: "POST", json: { old_url, new_url } }),
    onSuccess: () => toast.success(t("migrate_done")),
    onError: toastMutationError,
  })

  const stagingSite = useMutation({
    mutationFn: ({ id, staging_domain }: { id: number; staging_domain: string }) =>
      api(`/api/v1/wordpress/${id}/staging`, { method: "POST", json: { staging_domain } }),
    onSuccess: () => toast.success(t("staging_done")),
    onError: toastMutationError,
  })

  const updateThemes = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/wordpress/${id}/themes/update`, { method: "POST", json: { all: true } }),
    onSuccess: () => {
      toast.success(t("themes_updated"))
      void qc.invalidateQueries({ queryKey: ["wordpress-themes", selectedId] })
    },
    onError: toastMutationError,
  })

  const updatePlugins = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/wordpress/${id}/plugins/update`, { method: "POST", json: { all: true } }),
    onSuccess: () => {
      toast.success(t("plugins_updated"))
      void qc.invalidateQueries({ queryKey: ["wordpress-plugins", selectedId] })
    },
    onError: toastMutationError,
  })

  const checkIntegrity = useMutation({
    mutationFn: (id: number) =>
      api<{ integrity: { ok?: boolean; output?: string } }>(`/api/v1/wordpress/${id}/integrity`, {
        method: "POST",
      }),
    onSuccess: (res) => {
      toast.success(res.integrity?.ok ? t("integrity_ok") : t("integrity_fail"))
    },
    onError: toastMutationError,
  })

  const selected = (data?.sites ?? []).find((s) => s.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate({
                  domain: String(fd.get("domain") ?? ""),
                  path: String(fd.get("path") ?? ""),
                  title: String(fd.get("title") ?? ""),
                  admin_user: String(fd.get("admin_user") ?? ""),
                  admin_password: String(fd.get("admin_password") ?? ""),
                  admin_email: String(fd.get("admin_email") ?? ""),
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="domain">{t("field_domain")}</Label>
                <Input id="domain" name="domain" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="path">{t("field_path")}</Label>
                <Input id="path" name="path" required dir="ltr" className="font-mono" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">{t("field_title")}</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_user">{t("field_admin_user")}</Label>
                <Input id="admin_user" name="admin_user" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_password">{t("field_admin_password")}</Label>
                <Input
                  id="admin_password"
                  name="admin_password"
                  type="password"
                  required
                  minLength={8}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="admin_email">{t("field_admin_email")}</Label>
                <Input id="admin_email" name="admin_email" type="email" dir="ltr" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  {t("install")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.sites ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  >
                    <p className="font-medium">{s.title}</p>
                    <p className="text-muted-foreground font-mono text-xs" dir="ltr">
                      {s.domain} · {s.path}
                    </p>
                    {s.last_error ? (
                      <p className="text-destructive text-xs">{s.last_error}</p>
                    ) : null}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{s.status}</span>
                    <RequireRouteWrite>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(s.id)}
                      >
                        {t("delete")}
                      </Button>
                    </RequireRouteWrite>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("toolkit_title", { domain: selected.domain })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RequireRouteWrite>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("clone_target")}</Label>
                  <Input
                    value={cloneTarget}
                    onChange={(e) => setCloneTarget(e.target.value)}
                    dir="ltr"
                    className="font-mono"
                    placeholder="sites/clone-example"
                  />
                  <Button
                    size="sm"
                    disabled={!cloneTarget || cloneSite.isPending}
                    onClick={() =>
                      cloneSite.mutate({ id: selected.id, target_path: cloneTarget })
                    }
                  >
                    {t("clone")}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>{t("migrate_urls")}</Label>
                  <Input
                    value={migrateOld}
                    onChange={(e) => setMigrateOld(e.target.value)}
                    dir="ltr"
                    placeholder="https://old.example"
                  />
                  <Input
                    value={migrateNew}
                    onChange={(e) => setMigrateNew(e.target.value)}
                    dir="ltr"
                    placeholder="https://new.example"
                  />
                  <Button
                    size="sm"
                    disabled={!migrateOld || !migrateNew || migrateSite.isPending}
                    onClick={() =>
                      migrateSite.mutate({
                        id: selected.id,
                        old_url: migrateOld,
                        new_url: migrateNew,
                      })
                    }
                  >
                    {t("migrate")}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>{t("staging_domain")}</Label>
                  <Input
                    value={stagingDomain}
                    onChange={(e) => setStagingDomain(e.target.value)}
                    dir="ltr"
                    placeholder="staging.example.com"
                  />
                  <Button
                    size="sm"
                    disabled={!stagingDomain || stagingSite.isPending}
                    onClick={() =>
                      stagingSite.mutate({ id: selected.id, staging_domain: stagingDomain })
                    }
                  >
                    {t("staging")}
                  </Button>
                </div>
              </div>
            </RequireRouteWrite>

            <div className="flex flex-wrap gap-2">
              <RequireRouteWrite>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={updateThemes.isPending}
                  onClick={() => updateThemes.mutate(selected.id)}
                >
                  {t("update_all_themes")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={updatePlugins.isPending}
                  onClick={() => updatePlugins.mutate(selected.id)}
                >
                  {t("update_all_plugins")}
                </Button>
              </RequireRouteWrite>
              <Button
                size="sm"
                variant="outline"
                disabled={checkIntegrity.isPending}
                onClick={() => checkIntegrity.mutate(selected.id)}
              >
                {t("integrity_check")}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-medium">{t("themes")}</h3>
                <ul className="divide-y rounded-md border text-sm">
                  {(themesData?.themes ?? []).map((row, i) => (
                    <li key={row.name ?? i} className="flex justify-between px-3 py-2">
                      <span>{row.name}</span>
                      <span className="text-muted-foreground">{row.status ?? row.update}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-medium">{t("plugins")}</h3>
                <ul className="divide-y rounded-md border text-sm">
                  {(pluginsData?.plugins ?? []).map((row, i) => (
                    <li key={row.name ?? i} className="flex justify-between px-3 py-2">
                      <span>{row.name}</span>
                      <span className="text-muted-foreground">{row.status ?? row.update}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
