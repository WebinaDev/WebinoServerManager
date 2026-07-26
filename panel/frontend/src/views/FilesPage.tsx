"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, Download, FileText, FolderPlus, Pencil, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

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
  const t = useTranslations("files")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [path, setPath] = useState("/")
  const [editorPath, setEditorPath] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState("")
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [chmodTarget, setChmodTarget] = useState<FileEntry | null>(null)
  const [chmodValue, setChmodValue] = useState("644")
  const [newFileName, setNewFileName] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [remoteUrl, setRemoteUrl] = useState("")
  const [remoteName, setRemoteName] = useState("")
  const [searchHits, setSearchHits] = useState<{ path: string; name?: string }[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ["files", path],
    queryFn: () =>
      api<{ entries: FileEntry[] }>(
        `/api/v1/files?path=${encodeURIComponent(path)}`,
      ),
  })

  const recycle = useQuery({
    queryKey: ["files-recycle"],
    queryFn: () => api<{ items: { id: string; original?: string }[] }>("/api/v1/files/recycle"),
  })

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["files", path] })

  const search = useMutation({
    mutationFn: () =>
      api<{ hits: { path: string; name?: string }[] }>("/api/v1/files/search", {
        method: "POST",
        json: { path, query: searchQuery },
      }),
    onSuccess: (res) => setSearchHits(res.hits ?? []),
    onError: toastMutationError,
  })

  const remoteDl = useMutation({
    mutationFn: () =>
      api("/api/v1/files/remote-download", {
        method: "POST",
        json: { path: joinPath(path, remoteName || "download.bin"), url: remoteUrl },
      }),
    onSuccess: () => {
      toast.success(t("remote_ok"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const share = useMutation({
    mutationFn: (filePath: string) =>
      api<{ url: string }>("/api/v1/files/shares", {
        method: "POST",
        json: { path: filePath, expires_hours: 24 },
      }),
    onSuccess: (res) => {
      void navigator.clipboard?.writeText(res.url)
      toast.success(t("share_copied"))
    },
    onError: toastMutationError,
  })

  const restoreRecycle = useMutation({
    mutationFn: (id: string) =>
      api("/api/v1/files/recycle/restore", { method: "POST", json: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["files-recycle"] })
      invalidate()
    },
    onError: toastMutationError,
  })

  const purgeRecycle = useMutation({
    mutationFn: (id: string) =>
      api("/api/v1/files/recycle/purge", { method: "POST", json: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["files-recycle"] }),
    onError: toastMutationError,
  })

  const entries = data?.entries ?? []
  const breadcrumbs = useMemo(() => pathSegments(path), [path])

  const mkdir = useMutation({
    mutationFn: (folderPath: string) =>
      api("/api/v1/files/mkdir", { method: "POST", json: { path: folderPath } }),
    onSuccess: () => {
      toast.success(t("created"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (target: string) =>
      api("/api/v1/files", { method: "DELETE", json: { path: target } }),
    onSuccess: () => {
      toast.success(t("deleted"))
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
      toast.success(t("saved"))
      setEditorPath(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const rename = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      api("/api/v1/files/rename", { method: "POST", json: { path: from, dest: to } }),
    onSuccess: () => {
      toast.success(t("renamed"))
      setRenameTarget(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const chmod = useMutation({
    mutationFn: ({ filePath, mode }: { filePath: string; mode: string }) =>
      api("/api/v1/files/chmod", { method: "POST", json: { path: filePath, mode } }),
    onSuccess: () => {
      toast.success(t("chmod_ok"))
      setChmodTarget(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const columns: DataTableColumn<FileEntry>[] = [
    {
      id: "name",
      header: t("name"),
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
            {entry.is_dir ? t("type_dir") : t("type_file")}
          </span>
        </button>
      ),
    },
    {
      id: "size",
      header: t("size"),
      sortValue: (row) => row.size,
      cell: (entry) => (
        <span className="text-muted-foreground" dir="ltr">
          {entry.is_dir ? "—" : formatSize(entry.size)}
        </span>
      ),
    },
    {
      id: "mode",
      header: t("mode"),
      cell: (entry) => (
        <span className="text-muted-foreground font-mono text-xs" dir="ltr">
          {entry.mode ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: tCommon("actions"),
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
              {t("rename")}
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
                if (window.confirm(t("delete_confirm"))) {
                  remove.mutate(full)
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
            {!entry.is_dir ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => share.mutate(full)}
              >
                {t("share")}
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("tools_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="max-w-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_placeholder")}
            />
            <Button
              size="sm"
              disabled={!searchQuery || search.isPending}
              onClick={() => search.mutate()}
            >
              {t("search")}
            </Button>
          </div>
          {searchHits.length > 0 ? (
            <ul className="space-y-1 font-mono text-xs" dir="ltr">
              {searchHits.map((h) => (
                <li key={h.path}>
                  <button type="button" className="hover:underline" onClick={() => setPath(parentPath(h.path))}>
                    {h.path}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="max-w-md"
              dir="ltr"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://…"
            />
            <Input
              className="max-w-[10rem]"
              dir="ltr"
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value)}
              placeholder="name.bin"
            />
            <Button
              size="sm"
              disabled={!remoteUrl || remoteDl.isPending}
              onClick={() => remoteDl.mutate()}
            >
              {t("remote_download")}
            </Button>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("recycle_title")}</p>
            <ul className="space-y-1 text-sm">
              {(recycle.data?.items ?? []).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs" dir="ltr">
                    {item.original ?? item.id}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => restoreRecycle.mutate(item.id)}>
                    {t("recycle_restore")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => purgeRecycle.mutate(item.id)}>
                    {t("recycle_purge")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
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
              <Label htmlFor="path">{t("path")}</Label>
              <Input
                id="path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                dir="ltr"
                className="max-w-md font-mono"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => setPath(parentPath(path))}>
              {t("up")}
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
              <Label htmlFor="folder">{t("folder_name")}</Label>
              <Input id="folder" name="folder" dir="ltr" />
            </div>
            <Button type="submit" disabled={mkdir.isPending}>
              <FolderPlus className="me-1 size-4" />
              {t("mkdir")}
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
              <Label htmlFor="new-file">{t("new_file")}</Label>
              <Input
                id="new-file"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                dir="ltr"
              />
            </div>
            <Button type="submit" disabled={writeFile.isPending || !newFileName.trim()}>
              <FileText className="me-1 size-4" />
              {t("create_file")}
            </Button>
          </form>

          <div className="space-y-2">
            <Label htmlFor="upload">{t("upload")}</Label>
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
                  toast.success(t("uploaded"))
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
            searchPlaceholder={t("search")}
            searchFilter={(row, q) => row.name.toLowerCase().includes(q)}
            emptyMessage={t("empty")}
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
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={!editorPath || writeFile.isPending}
              onClick={() => {
                if (!editorPath) return
                writeFile.mutate({ filePath: editorPath, content: editorContent })
              }}
            >
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rename")}</DialogTitle>
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
            {tCommon("save")}
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
            {tCommon("save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
