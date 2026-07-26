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

type VersionRow = {
  id: number
  slug: string
  runtime: string
  name: string
  install_method: string
  version_label: string | null
  status: string
  host_status: string
  host_version: string | null
}

type ProjectRow = {
  id: number
  name: string
  runtime: string
  work_dir: string
  entry_script: string | null
  npm_script: string | null
  port: number | null
  status: string
  live_status?: string
  live_pid?: number | null
  last_error: string | null
}

export default function RuntimesPage() {
  const t = useTranslations("runtimes")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [logProjectId, setLogProjectId] = useState<number | null>(null)

  const { data: versionsData, isLoading: versionsLoading } = useQuery({
    queryKey: ["runtimes-versions"],
    queryFn: () => api<{ versions: VersionRow[] }>("/api/v1/runtimes/versions"),
    refetchInterval: 15_000,
  })

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["runtimes-projects"],
    queryFn: () => api<{ projects: ProjectRow[] }>("/api/v1/runtimes/projects"),
    refetchInterval: 5_000,
  })

  const { data: logsData } = useQuery({
    queryKey: ["runtimes-logs", logProjectId],
    queryFn: () =>
      api<{ logs: { logs?: string } }>(`/api/v1/runtimes/projects/${logProjectId}/logs?tail=200`),
    enabled: logProjectId !== null,
    refetchInterval: 5_000,
  })

  const installVersion = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/runtimes/versions/${id}/install`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("install_queued"))
      void qc.invalidateQueries({ queryKey: ["runtimes-versions"] })
    },
    onError: toastMutationError,
  })

  const createProject = useMutation({
    mutationFn: (body: Record<string, string | boolean>) =>
      api("/api/v1/runtimes/projects", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("project_created"))
      void qc.invalidateQueries({ queryKey: ["runtimes-projects"] })
    },
    onError: toastMutationError,
  })

  const projectAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "start" | "stop" | "restart" }) =>
      api(`/api/v1/runtimes/projects/${id}/${action}`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["runtimes-projects"] }),
    onError: toastMutationError,
  })

  const removeProject = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/runtimes/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["runtimes-projects"] })
      setLogProjectId(null)
    },
    onError: toastMutationError,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </CardHeader>
        <CardContent>
          {versionsLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(versionsData?.versions ?? []).map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{v.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {v.runtime} · {v.host_status}
                      {v.host_version ? ` · ${v.host_version}` : ""}
                    </p>
                  </div>
                  <RequireRouteWrite>
                    <Button
                      size="sm"
                      disabled={installVersion.isPending}
                      onClick={() => installVersion.mutate(v.id)}
                    >
                      {t("install")}
                    </Button>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("projects_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createProject.mutate({
                  name: String(fd.get("name") ?? ""),
                  runtime: String(fd.get("runtime") ?? "node"),
                  work_dir: String(fd.get("work_dir") ?? ""),
                  entry_script: String(fd.get("entry_script") ?? ""),
                  npm_script: String(fd.get("npm_script") ?? ""),
                  autostart: fd.get("autostart") === "on",
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">{t("field_name")}</Label>
                <Input id="name" name="name" required dir="ltr" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="runtime">{t("field_runtime")}</Label>
                <select
                  id="runtime"
                  name="runtime"
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue="node"
                >
                  <option value="node">Node.js</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="work_dir">{t("field_work_dir")}</Label>
                <Input id="work_dir" name="work_dir" required dir="ltr" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry_script">{t("field_entry_script")}</Label>
                <Input id="entry_script" name="entry_script" dir="ltr" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npm_script">{t("field_npm_script")}</Label>
                <Input id="npm_script" name="npm_script" dir="ltr" className="font-mono" />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <input id="autostart" name="autostart" type="checkbox" />
                <Label htmlFor="autostart">{t("autostart")}</Label>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={createProject.isPending}>
                  {t("create_project")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>

          {projectsLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(projectsData?.projects ?? []).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium font-mono" dir="ltr">
                      {p.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {p.runtime} · {p.work_dir} · {p.live_status ?? p.status}
                      {p.live_pid ? ` · pid ${p.live_pid}` : ""}
                    </p>
                    {p.last_error ? (
                      <p className="text-destructive text-xs">{p.last_error}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setLogProjectId(p.id)}>
                      {t("logs")}
                    </Button>
                    <RequireRouteWrite>
                      <Button
                        size="sm"
                        onClick={() => projectAction.mutate({ id: p.id, action: "start" })}
                      >
                        {t("start")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => projectAction.mutate({ id: p.id, action: "stop" })}
                      >
                        {t("stop")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => projectAction.mutate({ id: p.id, action: "restart" })}
                      >
                        {t("restart")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeProject.mutate(p.id)}
                      >
                        {t("delete")}
                      </Button>
                    </RequireRouteWrite>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {logProjectId !== null ? (
            <pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs" dir="ltr">
              {logsData?.logs?.logs ?? t("no_logs")}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
