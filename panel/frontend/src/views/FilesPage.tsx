"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, Download, FileText, FolderPlus, Pencil, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { DataTable, type DataTableColumn } from "@/components/data-table"
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
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type FileEntry = {
  name: string
  is_dir: boolean
  size: number
  mode?: string
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

function pathSegments(path: string): { label: string; path: string }[] {
  if (path === "/") {
    return [{ label: "/", path: "/" }]
  }
  const parts = path.split("/").filter(Boolean)
  const segments: { label: string; path: string }[] = [{ label: "/", path: "/" }]
  let acc = ""
  for (const part of parts) {
    acc += `/${part}`
    segments.push({ label: part, path: acc })
  }
  return segments
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilesPage() {
  const { t } = useTranslation(["files", "common"])
  const qc = useQueryClient()
  const [path, setPath] = useState("/")
  const [editorPath, setEditorPath] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState("")
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [chmodTarget, setChmodTarget] = useState<FileEntry | null>(null)
  const [chmodValue, setChmodValue] = useState("644")
  const [newFileName, setNewFileName] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["files", path],
    queryFn: () =>
      api<{ entries: FileEntry[] }>(
        `/api/v1/files?path=${encodeURIComponent(path)}`,
      ),
  })

  const entries = data?.entries ?? []
  const breadcrumbs = useMemo(() => pathSegments(path), [path])

  const invalidate = () => qc.invalidateQueries({ queryKey: ["files", path] })

  const mkdir = useMutation({
    mutationFn: (folderPath: string) =>
      api("/api/v1/files/mkdir", { method: "POST", json: { path: folderPath } }),
    onSuccess: () => {
      toast.success(t("files:created"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (target: string) =>
      api("/api/v1/files", { method: "DELETE", json: { path: target } }),
    onSuccess: () => {
      toast.success(t("files:deleted"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const readFile = useMutation({
    mutationFn: (filePath: string) =>
      api<{ content: string }>("/api/v1/files/read", {
        method: "POST",
        json: { path: filePath },
      }),
    onSuccess: (res) => {
      setEditorContent(res.content ?? "")
    },
    onError: toastMutationError,
  })

  const writeFile = useMutation({
    mutationFn: ({ filePath, content }: { filePath: string; content: string }) =>
      api("/api/v1/files/write", {
        method: "POST",
        json: { path: filePath, content },
      }),
    onSuccess: () => {
      toast.success(t("files:saved"))
      setEditorPath(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const rename = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      api("/api/v1/files/rename", { method: "POST", json: { path: from, dest: to } }),
    onSuccess: () => {
      toast.success(t("files:renamed", { defaultValue: "Renamed" }))
      setRenameTarget(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const chmod = useMutation({
    mutationFn: ({ filePath, mode }: { filePath: string; mode: string }) =>
      api("/api/v1/files/chmod", { method: "POST", json: { path: filePath, mode } }),
    onSuccess: () => {
      toast.success(t("files:chmod_ok", { defaultValue: "Permissions updated" }))
      setChmodTarget(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const columns: DataTableColumn<FileEntry>[] = [
    {
      id: "name",
      header: t("files:name", { defaultValue: "Name" }),
      sortValue: (row) => row.name,
      cell: (entry) => (
        <button
          type="button"
          className="flex items-center gap-2 text-start hover:underline"
          dir="ltr"
          onClick={() => {
            if (entry.is_dir) {
              setPath(joinPath(path, entry.name))
            }
          }}
        >
          <span>{entry.name}</span>
          <span className="text-muted-foreground text-xs">
            {entry.is_dir ? t("files:type_dir") : t("files:type_file")}
          </span>
        </button>
      ),
    },
    {
      id: "size",
      header: t("files:size", { defaultValue: "Size" }),
      sortValue: (row) => row.size,
      cell: (entry) => (
        <span className="text-muted-foreground" dir="ltr">
          {entry.is_dir ? "—" : formatSize(entry.size)}
        </span>
      ),
    },
    {
      id: "mode",
      header: t("files:mode", { defaultValue: "Mode" }),
      cell: (entry) => (
        <span className="text-muted-foreground font-mono text-xs" dir="ltr">
          {entry.mode ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("common:actions", { defaultValue: "Actions" }),
      cell: (entry) => {
        const full = joinPath(path, entry.name)
        return (
          <div className="flex flex-wrap gap-1">
            {!entry.is_dir ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditorPath(full)
                    readFile.mutate(full)
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await api<{ content: string }>("/api/v1/files/read", {
                        method: "POST",
                        json: { path: full },
                      })
                      const blob = new Blob([res.content ?? ""], { type: "text/plain" })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement("a")
                      a.href = url
                      a.download = entry.name
                      a.click()
                      URL.revokeObjectURL(url)
                    } catch (e) {
                      toastMutationError(e)
                    }
                  }}
                >
                  <Download className="size-3.5" />
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setRenameTarget(entry)
                setRenameValue(entry.name)
              }}
            >
              {t("files:rename", { defaultValue: "Rename" })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setChmodTarget(entry)
                setChmodValue(entry.mode?.replace(/^0?/, "") ?? "644")
              }}
            >
              chmod
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm(t("files:delete_confirm", { defaultValue: "Delete?" }))) {
                  remove.mutate(full)
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("files:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <nav className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm" dir="ltr">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3" /> : null}
                <button
                  type="button"
                  className="hover:text-foreground font-mono hover:underline"
                  onClick={() => setPath(crumb.path)}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </nav>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="path">{t("files:path")}</Label>
              <Input
                id="path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                dir="ltr"
                className="max-w-md font-mono"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => setPath(parentPath(path))}>
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
            <div className="space-y-1">
              <Label htmlFor="folder">{t("files:folder_name")}</Label>
              <Input id="folder" name="folder" dir="ltr" />
            </div>
            <Button type="submit" disabled={mkdir.isPending}>
              <FolderPlus className="me-1 size-4" />
              {t("files:mkdir")}
            </Button>
          </form>

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newFileName.trim()) return
              const filePath = joinPath(path, newFileName.trim())
              writeFile.mutate({ filePath, content: "" })
              setNewFileName("")
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="new-file">{t("files:new_file", { defaultValue: "New file" })}</Label>
              <Input
                id="new-file"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                dir="ltr"
              />
            </div>
            <Button type="submit" disabled={writeFile.isPending || !newFileName.trim()}>
              <FileText className="me-1 size-4" />
              {t("files:create_file", { defaultValue: "Create file" })}
            </Button>
          </form>

          <div className="space-y-2">
            <Label htmlFor="upload">{t("files:upload", { defaultValue: "Upload text file" })}</Label>
            <Input
              id="upload"
              type="file"
              dir="ltr"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  await api("/api/v1/files/write", {
                    method: "POST",
                    json: { path: joinPath(path, file.name), content: text },
                  })
                  toast.success(t("files:uploaded", { defaultValue: "Uploaded" }))
                  invalidate()
                } catch (err) {
                  toastMutationError(err)
                } finally {
                  e.target.value = ""
                }
              }}
            />
          </div>

          <DataTable
            columns={columns}
            data={entries}
            rowKey={(row) => row.name}
            isLoading={isLoading}
            searchPlaceholder={t("files:search", { defaultValue: "Search files…" })}
            searchFilter={(row, q) => row.name.toLowerCase().includes(q)}
            emptyMessage={t("files:empty", { defaultValue: "Directory is empty." })}
          />
        </CardContent>
      </Card>

      <Dialog open={editorPath !== null} onOpenChange={(open) => !open && setEditorPath(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle dir="ltr">{editorPath}</DialogTitle>
          </DialogHeader>
          <textarea
            className="border-input bg-background min-h-[320px] w-full rounded-md border p-3 font-mono text-sm"
            dir="ltr"
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditorPath(null)}>
              {t("common:cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="button"
              disabled={!editorPath || writeFile.isPending}
              onClick={() => {
                if (!editorPath) return
                writeFile.mutate({ filePath: editorPath, content: editorContent })
              }}
            >
              {t("files:save", { defaultValue: "Save" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("files:rename", { defaultValue: "Rename" })}</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} dir="ltr" />
          <Button
            type="button"
            disabled={!renameTarget || rename.isPending}
            onClick={() => {
              if (!renameTarget) return
              rename.mutate({
                from: joinPath(path, renameTarget.name),
                to: joinPath(path, renameValue),
              })
            }}
          >
            {t("common:save", { defaultValue: "Save" })}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={chmodTarget !== null} onOpenChange={(open) => !open && setChmodTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>chmod</DialogTitle>
          </DialogHeader>
          <Input value={chmodValue} onChange={(e) => setChmodValue(e.target.value)} dir="ltr" placeholder="644" />
          <Button
            type="button"
            disabled={!chmodTarget || chmod.isPending}
            onClick={() => {
              if (!chmodTarget) return
              chmod.mutate({
                filePath: joinPath(path, chmodTarget.name),
                mode: chmodValue,
              })
            }}
          >
            {t("common:save", { defaultValue: "Save" })}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
