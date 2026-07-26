"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
  hosting_account_id?: number | null
}

type DbUserRow = {
  id: number
  username: string
  host: string
  engine: string
  database_id: number | null
}

type RecycledDbRow = DbRow & { deleted_at?: string }

type RootPasswordStatus = {
  configured: boolean
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
  const searchParams = useSearchParams()
  const accountFilter = Number(searchParams.get("account") ?? "") || null
  const [engine, setEngine] = useState("mysql")
  const [importFile, setImportFile] = useState("")
  const [importName, setImportName] = useState("")
  const [newUser, setNewUser] = useState({ username: "", password: "", host: "localhost" })
  const [remoteEnabled, setRemoteEnabled] = useState(false)
  const [remoteIps, setRemoteIps] = useState("")
  const [passwordUser, setPasswordUser] = useState<DbUserRow | null>(null)
  const [passwordValue, setPasswordValue] = useState("")
  const [engineDb, setEngineDb] = useState<DbRow | null>(null)
  const [storageEngine, setStorageEngine] = useState("InnoDB")
  const [rootPassword, setRootPassword] = useState("")

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

  const { data: recycleData, isLoading: recycleLoading } = useQuery({
    queryKey: ["databases-recycle"],
    queryFn: () => api<{ databases: RecycledDbRow[] }>("/api/v1/databases/recycle"),
  })

  const { data: rootPasswordData } = useQuery({
    queryKey: ["databases-root-password"],
    queryFn: () => api<RootPasswordStatus>("/api/v1/databases/root-password"),
  })

  useEffect(() => {
    if (!remoteData?.remote_access) {
      return
    }
    setRemoteEnabled(remoteData.remote_access.enabled)
    setRemoteIps((remoteData.remote_access.allowed_ips ?? []).join("\n"))
  }, [remoteData])

  const databases = (data?.databases ?? []).filter(
    (db) => accountFilter == null || db.hosting_account_id === accountFilter,
  )
  const dbUsers = usersData?.users ?? []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["databases"] })
    qc.invalidateQueries({ queryKey: ["database-users"] })
    qc.invalidateQueries({ queryKey: ["databases-recycle"] })
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

  const redisInfo = useMutation({
    mutationFn: () => api<{ redis: { ping?: string; memory_mb?: number } }>("/api/v1/databases/redis/info"),
    onSuccess: (res) => {
      toast.success(`${t("redis_info")}: ${res.redis?.ping ?? "—"} · ${res.redis?.memory_mb ?? 0} MB`)
    },
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

  const restoreRecycle = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/databases/recycle/${id}/restore`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("restore"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const purgeRecycle = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/recycle/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("purge"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const repairDb = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/${id}/repair`, { method: "POST" }),
    onSuccess: () => toast.success(t("repair")),
    onError: toastMutationError,
  })

  const optimizeDb = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/${id}/optimize`, { method: "POST" }),
    onSuccess: () => toast.success(t("optimize")),
    onError: toastMutationError,
  })

  const changeStorageEngine = useMutation({
    mutationFn: ({ id, engine }: { id: number; engine: string }) =>
      api(`/api/v1/databases/${id}/engine`, { method: "POST", json: { engine } }),
    onSuccess: () => {
      toast.success(t("engine_updated"))
      setEngineDb(null)
    },
    onError: toastMutationError,
  })

  const updateRootPassword = useMutation({
    mutationFn: (password: string) =>
      api("/api/v1/databases/root-password", { method: "POST", json: { password } }),
    onSuccess: () => {
      toast.success(t("root_password_updated"))
      setRootPassword("")
      qc.invalidateQueries({ queryKey: ["databases-root-password"] })
    },
    onError: toastMutationError,
  })

  const refreshSize = useMutation({
    mutationFn: (id: number) =>
      api<{ size_mb: number }>(`/api/v1/databases/${id}/size`),
    onSuccess: () => {
      toast.success(t("size_refreshed"))
      qc.invalidateQueries({ queryKey: ["databases"] })
    },
    onError: toastMutationError,
  })

  const recycled = recycleData?.databases ?? []
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshSize.mutate(d.id)}
            disabled={refreshSize.isPending}
          >
            {t("refresh_size")}
          </Button>
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
            {(d.engine ?? "mysql") === "mysql" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => repairDb.mutate(d.id)}>
                  {t("repair")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => optimizeDb.mutate(d.id)}>
                  {t("optimize")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEngineDb(d)
                    setStorageEngine("InnoDB")
                  }}
                >
                  {t("storage_engine")}
                </Button>
              </>
            ) : null}
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
                  <option value="mongodb">{t("engine_mongodb")}</option>
                </select>
              </div>
              {engine === "redis" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => redisInfo.mutate(undefined)}
                  disabled={redisInfo.isPending}
                >
                  {t("redis_info")}
                </Button>
              ) : null}
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
          <CardTitle>{t("recycle_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                id: "name",
                header: t("field_name"),
                sortValue: (row) => row.name,
                cell: (d) => (
                  <span dir="ltr">
                    {d.name}{" "}
                    <span className="text-muted-foreground">({d.engine ?? "mysql"})</span>
                  </span>
                ),
              },
              {
                id: "actions",
                header: tCommon("actions"),
                cell: (d) => (
                  <RequireRouteWrite>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => restoreRecycle.mutate(d.id)}>
                        {t("restore")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t("purge_confirm"))) purgeRecycle.mutate(d.id)
                        }}
                      >
                        {t("purge")}
                      </Button>
                    </div>
                  </RequireRouteWrite>
                ),
              },
            ]}
            data={recycled}
            rowKey={(row) => row.id}
            isLoading={recycleLoading}
            emptyMessage={t("recycle_empty")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("root_password_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {rootPasswordData?.configured
              ? t("root_password_configured")
              : t("root_password_not_configured")}
          </p>
          <RequireRouteWrite>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="root-password">{t("field_password")}</Label>
                <Input
                  id="root-password"
                  type="password"
                  minLength={12}
                  value={rootPassword}
                  onChange={(e) => setRootPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
              <Button
                type="button"
                disabled={rootPassword.length < 12 || updateRootPassword.isPending}
                onClick={() => updateRootPassword.mutate(rootPassword)}
              >
                {t("root_password_save")}
              </Button>
            </div>
          </RequireRouteWrite>
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
              <Button onClick={() => saveRemoteAccess.mutate(undefined)} disabled={saveRemoteAccess.isPending}>
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
            <Button onClick={() => importDb.mutate(undefined)} disabled={importDb.isPending}>
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
            <Button onClick={() => createUser.mutate(undefined)} disabled={createUser.isPending}>
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

      <Dialog open={engineDb !== null} onOpenChange={(open) => !open && setEngineDb(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("storage_engine")}</DialogTitle>
          </DialogHeader>
          {engineDb ? (
            <p className="text-muted-foreground text-sm" dir="ltr">
              {engineDb.name}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="storage-engine">{t("field_storage_engine")}</Label>
            <select
              id="storage-engine"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={storageEngine}
              onChange={(e) => setStorageEngine(e.target.value)}
            >
              <option value="InnoDB">InnoDB</option>
              <option value="MyISAM">MyISAM</option>
            </select>
          </div>
          <Button
            type="button"
            disabled={!engineDb || changeStorageEngine.isPending}
            onClick={() => {
              if (!engineDb) return
              changeStorageEngine.mutate({ id: engineDb.id, engine: storageEngine })
            }}
          >
            {tCommon("save")}
          </Button>
        </DialogContent>
      </Dialog>

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
