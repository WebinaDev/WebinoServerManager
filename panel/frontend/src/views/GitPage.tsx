"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type GitRow = {
  id: number
  name: string
  repo_url: string
  branch: string
  target_dir: string
  status: string
  last_error: string | null
}

export default function GitPage() {
  const { t } = useTranslation(["git", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["git"],
    queryFn: () => api<{ repositories: GitRow[] }>("/api/v1/git"),
  })

  const create = useMutation({
    mutationFn: (body: {
      name: string
      repo_url: string
      branch?: string
      target_dir: string
    }) => api("/api/v1/git", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["git"] }),
  })

  const pull = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/git/${id}/pull`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["git"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/git/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["git"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("git:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                name: String(fd.get("name") ?? ""),
                repo_url: String(fd.get("repo_url") ?? ""),
                branch: String(fd.get("branch") ?? "") || undefined,
                target_dir: String(fd.get("target_dir") ?? ""),
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">{t("git:field_name")}</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">{t("git:field_branch")}</Label>
              <Input id="branch" name="branch" defaultValue="main" dir="ltr" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="repo_url">{t("git:field_repo_url")}</Label>
              <Input id="repo_url" name="repo_url" required dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="target_dir">{t("git:field_target_dir")}</Label>
              <Input id="target_dir" name="target_dir" required dir="ltr" className="font-mono" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {t("git:clone")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.repositories ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-muted-foreground font-mono text-xs" dir="ltr">
                      {r.repo_url} · {r.branch} → {r.target_dir}
                    </p>
                    {r.last_error ? (
                      <p className="text-destructive text-xs">{r.last_error}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{r.status}</span>
                    <RequireRouteWrite>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pull.isPending}
                        onClick={() => pull.mutate(r.id)}
                      >
                        {t("git:pull")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(r.id)}
                      >
                        {t("git:delete")}
                      </Button>
                    </RequireRouteWrite>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
