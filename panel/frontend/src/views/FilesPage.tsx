"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type FileEntry = {
  name: string
  is_dir: boolean
  size: number
}

function parentPath(path: string): string {
  const normalized = path.replace(/\/+$/, "") || "/"
  if (normalized === "/") return "/"
  const parts = normalized.split("/")
  parts.pop()
  return parts.join("/") || "/"
}

function joinPath(base: string, name: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base
  return b === "" || b === "/" ? `/${name}` : `${b}/${name}`
}

export default function FilesPage() {
  const { t } = useTranslation(["files", "common"])
  const qc = useQueryClient()
  const [path, setPath] = useState("/")

  const { data, isLoading } = useQuery({
    queryKey: ["files", path],
    queryFn: () =>
      api<{ entries: FileEntry[] }>(
        `/api/v1/files?path=${encodeURIComponent(path)}`,
      ),
  })

  const mkdir = useMutation({
    mutationFn: (folderPath: string) =>
      api("/api/v1/files/mkdir", { method: "POST", json: { path: folderPath } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", path] }),
  })

  const remove = useMutation({
    mutationFn: (target: string) =>
      api("/api/v1/files", { method: "DELETE", json: { path: target } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", path] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("files:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="path">{t("files:path")}</Label>
            <Input
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              dir="ltr"
              className="max-w-md font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setPath(parentPath(path))}
            >
              {t("files:up")}
            </Button>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const name = String(fd.get("folder") ?? "")
              if (!name) return
              mkdir.mutate(joinPath(path, name))
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="folder">{t("files:folder_name")}</Label>
              <Input id="folder" name="folder" dir="ltr" />
            </div>
            <Button type="submit" disabled={mkdir.isPending}>
              {t("files:mkdir")}
            </Button>
          </form>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.entries ?? []).map((entry) => {
                const full = joinPath(path, entry.name)
                return (
                  <li
                    key={entry.name}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <button
                      type="button"
                      className="text-start hover:underline"
                      dir="ltr"
                      onClick={() => {
                        if (entry.is_dir) setPath(full)
                      }}
                    >
                      {entry.name}{" "}
                      <span className="text-muted-foreground">
                        ({entry.is_dir ? t("files:type_dir") : t("files:type_file")})
                      </span>
                    </button>
                    <span className="text-muted-foreground">{entry.size}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove.mutate(full)}
                    >
                      {t("files:delete")}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
