"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type AppRow = {
  id: number
  name: string
  image: string
  status: string
  live_status?: string | null
  proxy_domain?: string | null
  proxy_port?: number | null
  ports?: string[]
  last_error?: string | null
}

type ImageRow = {
  id?: string
  repository?: string
  tag?: string
  size?: string
}

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

function parseEnv(raw: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of parseLines(raw)) {
    const idx = line.indexOf("=")
    if (idx > 0) {
      env[line.slice(0, idx)] = line.slice(idx + 1)
    }
  }
  return env
}

function statusBadge(status?: string | null) {
  const s = (status ?? "").toLowerCase()
  if (s.includes("up") || s === "active") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
  if (s.includes("exit") || s === "error") return "bg-destructive/15 text-destructive"
  return "bg-muted text-muted-foreground"
}

export default function AppsPage() {
  const t = useTranslations("apps")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [logsApp, setLogsApp] = useState<AppRow | null>(null)
  const [tab, setTab] = useState<
    "containers" | "compose" | "networks" | "volumes" | "registry" | "daemon"
  >("containers")

  const { data, isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: () => api<{ apps: AppRow[] }>("/api/v1/apps"),
  })

  const { data: imagesData } = useQuery({
    queryKey: ["apps-images"],
    queryFn: () => api<{ images: ImageRow[] }>("/api/v1/apps/images"),
  })

  const { data: composeData } = useQuery({
    queryKey: ["apps-compose"],
    queryFn: () =>
      api<{ projects: { id: number; name: string; status: string; last_error?: string | null }[] }>(
        "/api/v1/apps/compose",
      ),
    enabled: tab === "compose",
  })

  const { data: networksData } = useQuery({
    queryKey: ["apps-networks"],
    queryFn: () =>
      api<{ networks: { id?: string; name: string; driver?: string }[] }>("/api/v1/apps/networks"),
    enabled: tab === "networks",
  })

  const { data: volumesData } = useQuery({
    queryKey: ["apps-volumes"],
    queryFn: () =>
      api<{ volumes: { name: string; driver?: string }[] }>("/api/v1/apps/volumes"),
    enabled: tab === "volumes",
  })

  const { data: registriesData } = useQuery({
    queryKey: ["apps-registries"],
    queryFn: () =>
      api<{ registries: { id: number; name: string; server: string; username: string }[] }>(
        "/api/v1/apps/registries",
      ),
    enabled: tab === "registry",
  })

  const { data: daemonData } = useQuery({
    queryKey: ["apps-daemon"],
    queryFn: () =>
      api<{
        daemon: {
          "registry-mirrors"?: string[]
          "insecure-registries"?: string[]
          "log-opts"?: { "max-size"?: string; "max-file"?: string }
          "log-driver"?: string
          "data-root"?: string
          "live-restore"?: boolean
        }
      }>("/api/v1/apps/daemon"),
    enabled: tab === "daemon",
  })

  const { data: logsData, isFetching: logsLoading } = useQuery({
    queryKey: ["apps-logs", logsApp?.id],
    queryFn: () =>
      api<{ logs: { logs?: string } }>(`/api/v1/apps/${logsApp!.id}/logs?tail=200`),
    enabled: logsApp != null,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["apps"] })
    void qc.invalidateQueries({ queryKey: ["apps-images"] })
    void qc.invalidateQueries({ queryKey: ["apps-compose"] })
    void qc.invalidateQueries({ queryKey: ["apps-networks"] })
    void qc.invalidateQueries({ queryKey: ["apps-volumes"] })
    void qc.invalidateQueries({ queryKey: ["apps-registries"] })
    void qc.invalidateQueries({ queryKey: ["apps-daemon"] })
  }

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/apps", { method: "POST", json: body }),
    onSuccess: invalidate,
  })

  const start = useMutation({
    mutationFn: (id: number) => api(`/api/v1/apps/${id}/start`, { method: "POST" }),
    onSuccess: invalidate,
  })

  const stop = useMutation({
    mutationFn: (id: number) => api(`/api/v1/apps/${id}/stop`, { method: "POST" }),
    onSuccess: invalidate,
  })

  const restart = useMutation({
    mutationFn: (id: number) => api(`/api/v1/apps/${id}/restart`, { method: "POST" }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/apps/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  const pullImage = useMutation({
    mutationFn: (image: string) =>
      api("/api/v1/apps/images/pull", { method: "POST", json: { image } }),
    onSuccess: invalidate,
  })

  const removeImage = useMutation({
    mutationFn: (image: string) =>
      api("/api/v1/apps/images", { method: "DELETE", json: { image } }),
    onSuccess: invalidate,
  })

  const createCompose = useMutation({
    mutationFn: (body: { name: string; compose_yaml: string; env_file?: string }) =>
      api("/api/v1/apps/compose", { method: "POST", json: body }),
    onSuccess: invalidate,
  })
  const composeUp = useMutation({
    mutationFn: (id: number) => api(`/api/v1/apps/compose/${id}/up`, { method: "POST" }),
    onSuccess: invalidate,
  })
  const composeDown = useMutation({
    mutationFn: (id: number) => api(`/api/v1/apps/compose/${id}/down`, { method: "POST" }),
    onSuccess: invalidate,
  })
  const composeRemove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/apps/compose/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
  const createNetwork = useMutation({
    mutationFn: (name: string) => api("/api/v1/apps/networks", { method: "POST", json: { name } }),
    onSuccess: invalidate,
  })
  const removeNetwork = useMutation({
    mutationFn: (name: string) => api(`/api/v1/apps/networks/${name}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
  const createVolume = useMutation({
    mutationFn: (name: string) => api("/api/v1/apps/volumes", { method: "POST", json: { name } }),
    onSuccess: invalidate,
  })
  const removeVolume = useMutation({
    mutationFn: (name: string) => api(`/api/v1/apps/volumes/${name}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
  const saveRegistry = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/apps/registries", { method: "POST", json: body }),
    onSuccess: invalidate,
  })
  const removeRegistry = useMutation({
    mutationFn: (id: number) => api(`/api/v1/apps/registries/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
  const saveDaemon = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/apps/daemon", { method: "PUT", json: body }),
    onSuccess: invalidate,
  })

  const apps = data?.apps ?? []
  const images = imagesData?.images ?? []
  const tabs = [
    "containers",
    "compose",
    "networks",
    "volumes",
    "registry",
    "daemon",
  ] as const

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {t(`tab_${key}`)}
          </Button>
        ))}
      </div>

      {tab === "containers" ? (
        <>
      <Card>
        <CardHeader>
          <CardTitle>{t("create_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate({
                  name: String(fd.get("name")),
                  image: String(fd.get("image")),
                  ports: parseLines(String(fd.get("ports") ?? "")),
                  env: parseEnv(String(fd.get("env") ?? "")),
                  volumes: parseLines(String(fd.get("volumes") ?? "")),
                  proxy_domain: String(fd.get("proxy_domain") ?? "") || undefined,
                  proxy_port: fd.get("proxy_port")
                    ? Number(fd.get("proxy_port"))
                    : undefined,
                  command: String(fd.get("command") ?? "") || undefined,
                })
                e.currentTarget.reset()
              }}
            >
            <div className="space-y-2">
              <Label htmlFor="app-name">{t("field_name")}</Label>
              <Input id="app-name" name="name" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-image">{t("field_image")}</Label>
              <Input id="app-image" name="image" required dir="ltr" placeholder="nginx:alpine" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-ports">{t("field_ports")}</Label>
              <Textarea
                id="app-ports"
                name="ports"
                dir="ltr"
                placeholder="8080:80"
                rows={2}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-env">{t("field_env")}</Label>
              <Textarea id="app-env" name="env" dir="ltr" placeholder="KEY=value" rows={3} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-volumes">{t("field_volumes")}</Label>
              <Textarea
                id="app-volumes"
                name="volumes"
                dir="ltr"
                placeholder="/var/www/app:/app"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-domain">{t("field_proxy_domain")}</Label>
              <Input id="proxy-domain" name="proxy_domain" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-port">{t("field_proxy_port")}</Label>
              <Input id="proxy-port" name="proxy_port" type="number" dir="ltr" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-command">{t("field_command")}</Label>
              <Input id="app-command" name="command" dir="ltr" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {t("create")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {apps.length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">{t("empty")}</li>
              ) : (
                apps.map((app) => {
                  const displayStatus = app.live_status ?? app.status
                  return (
                    <li
                      key={app.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <div className="space-y-1">
                        <p className="font-medium" dir="ltr">
                          {app.name}
                        </p>
                        <p className="text-muted-foreground text-xs" dir="ltr">
                          {app.image}
                          {app.proxy_domain ? ` · ${app.proxy_domain}` : ""}
                        </p>
                        {app.last_error ? (
                          <p className="text-destructive text-xs" dir="ltr">
                            {app.last_error}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge(displayStatus)}`}
                        >
                          {displayStatus}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsApp(app)}
                        >
                          {t("logs")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link href={`/terminal?container=${encodeURIComponent(app.name)}`}>
                            {t("container_terminal")}
                          </Link>
                        </Button>
                        <RequireRouteWrite>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={start.isPending}
                            onClick={() => start.mutate(app.id)}
                          >
                            {t("start")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={stop.isPending}
                            onClick={() => stop.mutate(app.id)}
                          >
                            {t("stop")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={restart.isPending}
                            onClick={() => restart.mutate(app.id)}
                          >
                            {t("restart")}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (window.confirm(t("delete_confirm"))) {
                                remove.mutate(app.id)
                              }
                            }}
                          >
                            {t("delete")}
                          </Button>
                        </RequireRouteWrite>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("images_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                pullImage.mutate(String(fd.get("pull_image")))
                e.currentTarget.reset()
              }}
            >
              <Input
                name="pull_image"
                dir="ltr"
                placeholder="redis:7"
                className="max-w-md"
                required
              />
              <Button type="submit" disabled={pullImage.isPending}>
                {t("pull_image")}
              </Button>
            </form>
          </RequireRouteWrite>
          <ul className="divide-y rounded-md border">
            {images.length === 0 ? (
              <li className="text-muted-foreground px-4 py-3 text-sm">{t("images_empty")}</li>
            ) : (
              images.map((img, i) => {
                const ref = [img.repository, img.tag].filter(Boolean).join(":")
                return (
                  <li
                    key={img.id ?? ref ?? i}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span dir="ltr">{ref || img.id}</span>
                    <div className="flex items-center gap-2">
                      {img.size ? (
                        <span className="text-muted-foreground text-xs">{img.size}</span>
                      ) : null}
                      {ref ? (
                        <RequireRouteWrite>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={removeImage.isPending}
                            onClick={() => {
                              if (window.confirm(t("delete_image_confirm"))) {
                                removeImage.mutate(ref)
                              }
                            }}
                          >
                            {t("delete")}
                          </Button>
                        </RequireRouteWrite>
                      ) : null}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </CardContent>
      </Card>
        </>
      ) : null}

      {tab === "compose" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("compose_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RequireRouteWrite>
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  createCompose.mutate({
                    name: String(fd.get("name")),
                    compose_yaml: String(fd.get("compose_yaml")),
                    env_file: String(fd.get("env_file") ?? "") || undefined,
                  })
                  e.currentTarget.reset()
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="compose-name">{t("compose_name")}</Label>
                  <Input id="compose-name" name="name" required dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compose-yaml">{t("compose_yaml")}</Label>
                  <Textarea id="compose-yaml" name="compose_yaml" required dir="ltr" rows={8} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compose-env">{t("compose_env")}</Label>
                  <Textarea id="compose-env" name="env_file" dir="ltr" rows={3} />
                </div>
                <Button type="submit" disabled={createCompose.isPending}>
                  {t("compose_up")}
                </Button>
              </form>
            </RequireRouteWrite>
            <ul className="divide-y rounded-md border">
              {(composeData?.projects ?? []).length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">{t("compose_empty")}</li>
              ) : (
                (composeData?.projects ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium" dir="ltr">
                        {p.name}
                      </p>
                      <p className="text-muted-foreground text-xs">{p.status}</p>
                    </div>
                    <RequireRouteWrite>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => composeUp.mutate(p.id)}
                        >
                          {t("compose_up")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => composeDown.mutate(p.id)}
                        >
                          {t("compose_down")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => composeRemove.mutate(p.id)}
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    </RequireRouteWrite>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tab === "networks" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("networks_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RequireRouteWrite>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  createNetwork.mutate(String(fd.get("name")))
                  e.currentTarget.reset()
                }}
              >
                <Input name="name" required dir="ltr" placeholder="mynet" className="max-w-xs" />
                <Button type="submit">{t("create")}</Button>
              </form>
            </RequireRouteWrite>
            <ul className="divide-y rounded-md border">
              {(networksData?.networks ?? []).map((n) => (
                <li
                  key={n.name}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span dir="ltr">
                    {n.name}
                    {n.driver ? ` · ${n.driver}` : ""}
                  </span>
                  <RequireRouteWrite>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeNetwork.mutate(n.name)}
                    >
                      {t("delete")}
                    </Button>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tab === "volumes" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("volumes_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RequireRouteWrite>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  createVolume.mutate(String(fd.get("name")))
                  e.currentTarget.reset()
                }}
              >
                <Input name="name" required dir="ltr" placeholder="myvol" className="max-w-xs" />
                <Button type="submit">{t("create")}</Button>
              </form>
            </RequireRouteWrite>
            <ul className="divide-y rounded-md border">
              {(volumesData?.volumes ?? []).map((v) => (
                <li
                  key={v.name}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span dir="ltr">{v.name}</span>
                  <RequireRouteWrite>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeVolume.mutate(v.name)}
                    >
                      {t("delete")}
                    </Button>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tab === "registry" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("registry_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RequireRouteWrite>
              <form
                className="grid gap-3 md:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  saveRegistry.mutate({
                    name: String(fd.get("name")),
                    server: String(fd.get("server")),
                    username: String(fd.get("username")),
                    password: String(fd.get("password")),
                    login: true,
                  })
                  e.currentTarget.reset()
                }}
              >
                <Input name="name" required placeholder={t("registry_name")} />
                <Input name="server" required dir="ltr" placeholder="https://index.docker.io/v1/" />
                <Input name="username" required dir="ltr" />
                <Input name="password" type="password" required dir="ltr" />
                <Button type="submit" className="md:col-span-2">
                  {t("registry_save")}
                </Button>
              </form>
            </RequireRouteWrite>
            <ul className="divide-y rounded-md border">
              {(registriesData?.registries ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span dir="ltr">
                    {r.name} · {r.server} · {r.username}
                  </span>
                  <RequireRouteWrite>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeRegistry.mutate(r.id)}
                    >
                      {t("delete")}
                    </Button>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tab === "daemon" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("daemon_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RequireRouteWrite>
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const mirrors = String(fd.get("mirrors") ?? "")
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean)
                  const insecure = String(fd.get("insecure") ?? "")
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean)
                  saveDaemon.mutate({
                    "registry-mirrors": mirrors,
                    "insecure-registries": insecure,
                    "log-opts": {
                      "max-size": String(fd.get("max_size") ?? "") || undefined,
                      "max-file": String(fd.get("max_file") ?? "") || undefined,
                    },
                    "log-driver": String(fd.get("log_driver") ?? "") || undefined,
                    "data-root": String(fd.get("data_root") ?? "") || undefined,
                    "live-restore": fd.get("live_restore") === "on",
                  })
                }}
              >
                <div className="space-y-2">
                  <Label>{t("daemon_mirrors")}</Label>
                  <Textarea
                    name="mirrors"
                    dir="ltr"
                    rows={3}
                    defaultValue={(daemonData?.daemon?.["registry-mirrors"] ?? []).join("\n")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("daemon_insecure")}</Label>
                  <Textarea
                    name="insecure"
                    dir="ltr"
                    rows={2}
                    defaultValue={(daemonData?.daemon?.["insecure-registries"] ?? []).join("\n")}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("daemon_max_size")}</Label>
                    <Input
                      name="max_size"
                      dir="ltr"
                      defaultValue={daemonData?.daemon?.["log-opts"]?.["max-size"] ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("daemon_max_file")}</Label>
                    <Input
                      name="max_file"
                      dir="ltr"
                      defaultValue={daemonData?.daemon?.["log-opts"]?.["max-file"] ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("daemon_log_driver")}</Label>
                    <Input
                      name="log_driver"
                      dir="ltr"
                      placeholder="json-file"
                      defaultValue={daemonData?.daemon?.["log-driver"] ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("daemon_data_root")}</Label>
                    <Input
                      name="data_root"
                      dir="ltr"
                      placeholder="/var/lib/docker"
                      defaultValue={daemonData?.daemon?.["data-root"] ?? ""}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="live_restore"
                    defaultChecked={Boolean(daemonData?.daemon?.["live-restore"])}
                  />
                  {t("daemon_live_restore")}
                </label>
                <Button type="submit" disabled={saveDaemon.isPending}>
                  {t("daemon_save")}
                </Button>
              </form>
            </RequireRouteWrite>
          </CardContent>
        </Card>
      ) : null}

      <Sheet open={logsApp != null} onOpenChange={(open) => !open && setLogsApp(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {t("logs_title")} — {logsApp?.name}
            </SheetTitle>
          </SheetHeader>
          {logsLoading ? (
            <p className="mt-4">{tCommon("loading")}</p>
          ) : (
            <pre
              className="bg-muted mt-4 max-h-[70vh] overflow-auto rounded p-3 text-xs whitespace-pre-wrap"
              dir="ltr"
            >
              {logsData?.logs?.logs ?? t("logs_empty")}
            </pre>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
