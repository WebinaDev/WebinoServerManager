"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation(["apps", "common"])
  const qc = useQueryClient()
  const [logsApp, setLogsApp] = useState<AppRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: () => api<{ apps: AppRow[] }>("/api/v1/apps"),
  })

  const { data: imagesData } = useQuery({
    queryKey: ["apps-images"],
    queryFn: () => api<{ images: ImageRow[] }>("/api/v1/apps/images"),
  })

  const { data: logsData, isFetching: logsLoading } = useQuery({
    queryKey: ["apps-logs", logsApp?.id],
    queryFn: () =>
      api<{ logs: { logs?: string } }>(`/api/v1/apps/${logsApp!.id}/logs?tail=200`),
    enabled: logsApp != null,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["apps"] })
    qc.invalidateQueries({ queryKey: ["apps-images"] })
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

  const apps = data?.apps ?? []
  const images = imagesData?.images ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("apps:create_title")}</CardTitle>
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
              <Label htmlFor="app-name">{t("apps:field_name")}</Label>
              <Input id="app-name" name="name" required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-image">{t("apps:field_image")}</Label>
              <Input id="app-image" name="image" required dir="ltr" placeholder="nginx:alpine" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-ports">{t("apps:field_ports")}</Label>
              <Textarea
                id="app-ports"
                name="ports"
                dir="ltr"
                placeholder="8080:80"
                rows={2}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-env">{t("apps:field_env")}</Label>
              <Textarea id="app-env" name="env" dir="ltr" placeholder="KEY=value" rows={3} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-volumes">{t("apps:field_volumes")}</Label>
              <Textarea
                id="app-volumes"
                name="volumes"
                dir="ltr"
                placeholder="/var/www/app:/app"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-domain">{t("apps:field_proxy_domain")}</Label>
              <Input id="proxy-domain" name="proxy_domain" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-port">{t("apps:field_proxy_port")}</Label>
              <Input id="proxy-port" name="proxy_port" type="number" dir="ltr" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-command">{t("apps:field_command")}</Label>
              <Input id="app-command" name="command" dir="ltr" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {t("apps:create")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("apps:list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {apps.length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">{t("apps:empty")}</li>
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
                          {t("apps:logs")}
                        </Button>
                        <RequireRouteWrite>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={start.isPending}
                            onClick={() => start.mutate(app.id)}
                          >
                            {t("apps:start")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={stop.isPending}
                            onClick={() => stop.mutate(app.id)}
                          >
                            {t("apps:stop")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={restart.isPending}
                            onClick={() => restart.mutate(app.id)}
                          >
                            {t("apps:restart")}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (window.confirm(t("apps:delete_confirm"))) {
                                remove.mutate(app.id)
                              }
                            }}
                          >
                            {t("apps:delete")}
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
          <CardTitle>{t("apps:images_title")}</CardTitle>
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
                {t("apps:pull_image")}
              </Button>
            </form>
          </RequireRouteWrite>
          <ul className="divide-y rounded-md border">
            {images.length === 0 ? (
              <li className="text-muted-foreground px-4 py-3 text-sm">{t("apps:images_empty")}</li>
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
                              if (window.confirm(t("apps:delete_image_confirm"))) {
                                removeImage.mutate(ref)
                              }
                            }}
                          >
                            {t("apps:delete")}
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

      <Sheet open={logsApp != null} onOpenChange={(open) => !open && setLogsApp(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {t("apps:logs_title")} — {logsApp?.name}
            </SheetTitle>
          </SheetHeader>
          {logsLoading ? (
            <p className="mt-4">{t("common:loading")}</p>
          ) : (
            <pre
              className="bg-muted mt-4 max-h-[70vh] overflow-auto rounded p-3 text-xs whitespace-pre-wrap"
              dir="ltr"
            >
              {logsData?.logs?.logs ?? t("apps:logs_empty")}
            </pre>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
