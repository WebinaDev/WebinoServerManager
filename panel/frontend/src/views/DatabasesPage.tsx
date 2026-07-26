"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"

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
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type DbRow = {
  id: number
  name: string
  engine?: string
  size_mb?: number
  db_user: string | null
  status: string
}

type DbUserRow = {
  id: number
  username: string
  host: string
  engine: string
  database_id: number | null
}

type RemoteAccess = {
  enabled: boolean
  allowed_ips: string[]
  host: string
  mysql_port: number
  pgsql_port: number
}

export default function DatabasesPage() {
  const t = useTranslations("databases")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [engine, setEngine] = useState("mysql")
  const [importFile, setImportFile] = useState("")
  const [importName, setImportName] = useState("")
  const [newUser, setNewUser] = useState({ username: "", password: "", host: "localhost" })
  const [remoteEnabled, setRemoteEnabled] = useState(false)
  const [remoteIps, setRemoteIps] = useState("")
  const [passwordUser, setPasswordUser] = useState<DbUserRow | null>(null)
  const [passwordValue, setPasswordValue] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["databases"],
    queryFn: () => api<{ databases: DbRow[] }>("/api/v1/databases"),
  })

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["database-users"],
    queryFn: () => api<{ users: DbUserRow[] }>("/api/v1/databases/users"),
  })

  const { data: remoteData } = useQuery({
    queryKey: ["databases-remote-access"],
    queryFn: () => api<{ remote_access: RemoteAccess }>("/api/v1/databases/remote-access"),
  })

  useEffect(() => {
    if (!remoteData?.remote_access) {
      return
    }
    setRemoteEnabled(remoteData.remote_access.enabled)
    setRemoteIps((remoteData.remote_access.allowed_ips ?? []).join("\n"))
  }, [remoteData])

  const databases = data?.databases ?? []
  const dbUsers = usersData?.users ?? []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["databases"] })
    qc.invalidateQueries({ queryKey: ["database-users"] })
  }

  const create = useMutation({
    mutationFn: (name: string) =>
      api("/api/v1/databases", {
        method: "POST",
        json: { name, engine, create_user: engine === "mysql" },
      }),
    onSuccess: () => {
      toast.success(t("create"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const exportDb = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/${id}/export`, { method: "POST" }),
    onError: toastMutationError,
  })

  const importDb = useMutation({
    mutationFn: () =>
      api("/api/v1/databases/import", {
        method: "POST",
        json: { name: importName, file: importFile, engine },
      }),
    onSuccess: invalidate,
    onError: toastMutationError,
  })

  const createUser = useMutation({
    mutationFn: () =>
      api("/api/v1/databases/users", {
        method: "POST",
        json: { ...newUser, grant: true },
      }),
    onSuccess: () => {
      toast.success(t("create_user"))
      invalidate()
      setNewUser({ username: "", password: "", host: "localhost" })
    },
    onError: toastMutationError,
  })

  const removeUser = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete_user"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const updateUserPassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api(`/api/v1/databases/users/${id}`, { method: "PATCH", json: { password } }),
    onSuccess: () => {
      toast.success(t("user_password_updated"))
      setPasswordUser(null)
      setPasswordValue("")
    },
    onError: toastMutationError,
  })

  const saveRemoteAccess = useMutation({
    mutationFn: () =>
      api("/api/v1/databases/remote-access", {
        method: "POST",
        json: {
          enabled: remoteEnabled,
          allowed_ips: remoteIps
            .split(/[\n,]+/)
            .map((ip) => ip.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["databases-remote-access"] }),
    onError: toastMutationError,
  })

  const remote = remoteData?.remote_access

  const databaseColumns: DataTableColumn<DbRow>[] = [
    {
      id: "name",
      header: t("field_name"),
      sortValue: (row) => row.name,
      cell: (d) => (
        <span>
          {d.name}{" "}
          <span className="text-muted-foreground">
            ({d.engine ?? "mysql"} · {d.size_mb ?? 0} MB)
          </span>
        </span>
      ),
    },
    {
      id: "user",
      header: t("field_user"),
      sortValue: (row) => row.db_user ?? "",
      cell: (d) => (
        <span className="text-muted-foreground">{d.db_user ?? tCommon("em_dash")}</span>
      ),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: (d) => (
        <div className="flex flex-wrap items-center gap-2">
          {d.engine === "pgsql" ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/phppgadmin?db=${d.id}`}>{t("open_phppgadmin")}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/phpmyadmin?db=${d.id}`}>{t("open_phpmyadmin")}</Link>
            </Button>
          )}
          <RequireRouteWrite>
            <Button size="sm" variant="outline" onClick={() => exportDb.mutate(d.id)}>
              {t("export")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm(t("delete_confirm"))) remove.mutate(d.id)
              }}
            >
              {t("delete")}
            </Button>
          </RequireRouteWrite>
        </div>
      ),
    },
  ]

  const userColumns: DataTableColumn<DbUserRow>[] = [
    {
      id: "username",
      header: t("field_user"),
      sortValue: (row) => row.username,
      cell: (u) => (
        <span dir="ltr">
          {u.username}@{u.host} ({u.engine})
        </span>
      ),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: (u) => (
        <RequireRouteWrite>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPasswordUser(u)
                setPasswordValue("")
              }}
            >
              {t("change_password")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => removeUser.mutate(u.id)}>
              {t("delete_user")}
            </Button>
          </div>
        </RequireRouteWrite>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="flex flex-col gap-3 md:flex-row md:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate(String(fd.get("name") ?? ""))
                e.currentTarget.reset()
              }}
            >
              <div className="grow space-y-2">
                <Label htmlFor="name">{t("field_name")}</Label>
                <Input id="name" name="name" pattern="[a-zA-Z0-9_]+" required />
              </div>
              <div className="space-y-2">
                <Label>{t("field_engine")}</Label>
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                >
                  <option value="mysql">MySQL</option>
                  <option value="pgsql">PostgreSQL</option>
                  <option value="redis">{t("engine_redis")}</option>
                </select>
              </div>
              <Button type="submit" disabled={create.isPending}>
                {t("create")}
              </Button>
            </form>
          </RequireRouteWrite>
          <DataTable
            columns={databaseColumns}
            data={databases}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("search")}
            searchFilter={(row, q) =>
              row.name.toLowerCase().includes(q) ||
              (row.engine ?? "mysql").toLowerCase().includes(q) ||
              (row.db_user ?? "").toLowerCase().includes(q)
            }
            emptyMessage={t("empty")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("remote_access_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {remote ? (
            <div className="text-muted-foreground space-y-1 text-sm">
              <p>
                {t("remote_access_host")}: <span className="text-foreground">{remote.host}</span>
              </p>
              <p>
                {t("remote_access_ports")}: MySQL {remote.mysql_port}, PostgreSQL{" "}
                {remote.pgsql_port}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{tCommon("loading")}</p>
          )}
          <RequireRouteWrite>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={remoteEnabled}
                  onChange={(e) => setRemoteEnabled(e.target.checked)}
                />
                {t("remote_access_enabled")}
              </label>
              <div className="space-y-1">
                <Label htmlFor="remote_ips">{t("remote_access_ips")}</Label>
                <textarea
                  id="remote_ips"
                  className="border-input bg-background min-h-[6rem] w-full rounded-md border px-3 py-2 text-sm"
                  value={remoteIps}
                  onChange={(e) => setRemoteIps(e.target.value)}
                  placeholder="203.0.113.10"
                  disabled={!remoteEnabled}
                />
              </div>
              <Button onClick={() => saveRemoteAccess.mutate()} disabled={saveRemoteAccess.isPending}>
                {t("remote_access_save")}
              </Button>
            </div>
          </RequireRouteWrite>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("import_title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <RequireRouteWrite>
            <div className="space-y-1">
              <Label>{t("field_name")}</Label>
              <Input value={importName} onChange={(e) => setImportName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("field_file")}</Label>
              <Input value={importFile} onChange={(e) => setImportFile(e.target.value)} />
            </div>
            <Button onClick={() => importDb.mutate()} disabled={importDb.isPending}>
              {t("import")}
            </Button>
          </RequireRouteWrite>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("users_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>{t("field_user")}</Label>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("field_host")}</Label>
                <Input
                  value={newUser.host}
                  onChange={(e) => setNewUser({ ...newUser, host: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("field_password")}</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>
              {t("create_user")}
            </Button>
          </RequireRouteWrite>
          <DataTable
            columns={userColumns}
            data={dbUsers}
            rowKey={(row) => row.id}
            isLoading={usersLoading}
            searchPlaceholder={t("search_users")}
            searchFilter={(row, q) =>
              row.username.toLowerCase().includes(q) ||
              row.host.toLowerCase().includes(q) ||
              row.engine.toLowerCase().includes(q)
            }
            emptyMessage={t("empty_users")}
          />
        </CardContent>
      </Card>

      <Dialog open={passwordUser !== null} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("change_password")}</DialogTitle>
          </DialogHeader>
          {passwordUser ? (
            <p className="text-muted-foreground text-sm" dir="ltr">
              {passwordUser.username}@{passwordUser.host}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="db-user-password">{t("field_password")}</Label>
            <Input
              id="db-user-password"
              type="password"
              minLength={8}
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={!passwordUser || passwordValue.length < 8 || updateUserPassword.isPending}
            onClick={() => {
              if (!passwordUser) return
              updateUserPassword.mutate({ id: passwordUser.id, password: passwordValue })
            }}
          >
            {tCommon("save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
