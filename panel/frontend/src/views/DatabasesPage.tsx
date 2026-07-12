"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

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
  const { t } = useTranslation(["databases", "common"])
  const qc = useQueryClient()
  const [engine, setEngine] = useState("mysql")
  const [importFile, setImportFile] = useState("")
  const [importName, setImportName] = useState("")
  const [newUser, setNewUser] = useState({ username: "", password: "", host: "localhost" })
  const [remoteEnabled, setRemoteEnabled] = useState(false)
  const [remoteIps, setRemoteIps] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["databases"],
    queryFn: () => api<{ databases: DbRow[] }>("/api/v1/databases"),
  })

  const { data: usersData } = useQuery({
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
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  const exportDb = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/${id}/export`, { method: "POST" }),
  })

  const importDb = useMutation({
    mutationFn: () =>
      api("/api/v1/databases/import", {
        method: "POST",
        json: { name: importName, file: importFile, engine },
      }),
    onSuccess: invalidate,
  })

  const createUser = useMutation({
    mutationFn: () =>
      api("/api/v1/databases/users", {
        method: "POST",
        json: { ...newUser, grant: true },
      }),
    onSuccess: () => {
      invalidate()
      setNewUser({ username: "", password: "", host: "localhost" })
    },
  })

  const removeUser = useMutation({
    mutationFn: (id: number) => api(`/api/v1/databases/users/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
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
  })

  const remote = remoteData?.remote_access

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("databases:title")}</CardTitle>
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
                <Label htmlFor="name">{t("databases:field_name")}</Label>
                <Input id="name" name="name" pattern="[a-zA-Z0-9_]+" required />
              </div>
              <div className="space-y-2">
                <Label>{t("databases:field_engine")}</Label>
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                >
                  <option value="mysql">MySQL</option>
                  <option value="pgsql">PostgreSQL</option>
                </select>
              </div>
              <Button type="submit" disabled={create.isPending}>
                {t("databases:create")}
              </Button>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.databases ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    {d.name}{" "}
                    <span className="text-muted-foreground">
                      ({d.engine ?? "mysql"} · {d.size_mb ?? 0} MB)
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{d.db_user ?? t("common:em_dash")}</span>
                    {d.engine === "pgsql" ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/phppgadmin?db=${d.id}`}>{t("databases:open_phppgadmin")}</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/phpmyadmin?db=${d.id}`}>{t("databases:open_phpmyadmin")}</Link>
                      </Button>
                    )}
                    <RequireRouteWrite>
                      <Button size="sm" variant="outline" onClick={() => exportDb.mutate(d.id)}>
                        {t("databases:export")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("databases:delete_confirm"))) remove.mutate(d.id)
                        }}
                      >
                        {t("databases:delete")}
                      </Button>
                    </RequireRouteWrite>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("databases:remote_access_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {remote ? (
            <div className="text-muted-foreground space-y-1 text-sm">
              <p>
                {t("databases:remote_access_host")}: <span className="text-foreground">{remote.host}</span>
              </p>
              <p>
                {t("databases:remote_access_ports")}: MySQL {remote.mysql_port}, PostgreSQL{" "}
                {remote.pgsql_port}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("common:loading")}</p>
          )}
          <RequireRouteWrite>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={remoteEnabled}
                  onChange={(e) => setRemoteEnabled(e.target.checked)}
                />
                {t("databases:remote_access_enabled")}
              </label>
              <div className="space-y-1">
                <Label htmlFor="remote_ips">{t("databases:remote_access_ips")}</Label>
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
                {t("databases:remote_access_save")}
              </Button>
            </div>
          </RequireRouteWrite>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("databases:import_title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <RequireRouteWrite>
            <div className="space-y-1">
              <Label>{t("databases:field_name")}</Label>
              <Input value={importName} onChange={(e) => setImportName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("databases:field_file")}</Label>
              <Input value={importFile} onChange={(e) => setImportFile(e.target.value)} />
            </div>
            <Button onClick={() => importDb.mutate()} disabled={importDb.isPending}>
              {t("databases:import")}
            </Button>
          </RequireRouteWrite>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("databases:users_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>{t("databases:field_user")}</Label>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("databases:field_host")}</Label>
                <Input
                  value={newUser.host}
                  onChange={(e) => setNewUser({ ...newUser, host: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("databases:field_password")}</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>
              {t("databases:create_user")}
            </Button>
          </RequireRouteWrite>
          <ul className="divide-y rounded-md border">
            {(usersData?.users ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {u.username}@{u.host} ({u.engine})
                </span>
                <RequireRouteWrite>
                  <Button size="sm" variant="outline" onClick={() => removeUser.mutate(u.id)}>
                    {t("databases:delete_user")}
                  </Button>
                </RequireRouteWrite>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
