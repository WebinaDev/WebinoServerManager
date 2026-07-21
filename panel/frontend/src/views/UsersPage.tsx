"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

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

type UserRow = {
  id: number
  name: string
  username: string
  email: string | null
  roles: { name: string }[]
}

type RoleRow = {
  id: number
  name: string
  permissions?: { name: string }[]
}

type RolesResponse = {
  roles: RoleRow[]
  permissions: string[]
}

function RolesCard() {
  const t = useTranslations("users")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()

  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [newRoleName, setNewRoleName] = useState("")
  const [newRolePerms, setNewRolePerms] = useState<string[]>([])

  const { data } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api<RolesResponse>("/api/v1/roles"),
  })

  const roles = data?.roles ?? []
  const allPermissions = data?.permissions ?? []

  const createRole = useMutation({
    mutationFn: (body: { name: string; permissions: string[] }) =>
      api("/api/v1/roles", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("create_role"))
      qc.invalidateQueries({ queryKey: ["roles"] })
      setNewRoleName("")
      setNewRolePerms([])
    },
    onError: toastMutationError,
  })

  const updateRole = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: string[] }) =>
      api(`/api/v1/roles/${id}`, { method: "PATCH", json: { permissions } }),
    onSuccess: () => {
      toast.success(t("save"))
      setEditingRole(null)
      qc.invalidateQueries({ queryKey: ["roles"] })
    },
    onError: toastMutationError,
  })

  const deleteRole = useMutation({
    mutationFn: (id: number) => api(`/api/v1/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete_role"))
      qc.invalidateQueries({ queryKey: ["roles"] })
    },
    onError: toastMutationError,
  })

  function togglePerm(perms: string[], name: string): string[] {
    return perms.includes(name) ? perms.filter((p) => p !== name) : [...perms, name]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("roles_title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-md border">
          {roles.length === 0 ? (
            <li className="text-muted-foreground px-4 py-3 text-sm">{t("empty")}</li>
          ) : (
            roles.map((role) => {
              const isProtected = role.name === "admin"
              return (
                <li key={role.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">{role.name}</p>
                    {isProtected && (
                      <p className="text-muted-foreground text-xs">{t("role_protected_hint")}</p>
                    )}
                    {!isProtected && (role.permissions ?? []).length > 0 && (
                      <p className="text-muted-foreground font-mono text-xs">
                        {(role.permissions ?? []).map((p) => p.name).join(", ")}
                      </p>
                    )}
                  </div>
                  {!isProtected && (
                    <RequireRouteWrite>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingRole(role)
                            setEditPerms((role.permissions ?? []).map((p) => p.name))
                          }}
                        >
                          {tCommon("edit")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (window.confirm(t("delete_role"))) {
                              deleteRole.mutate(role.id)
                            }
                          }}
                        >
                          {t("delete_role")}
                        </Button>
                      </div>
                    </RequireRouteWrite>
                  )}
                </li>
              )
            })
          )}
        </ul>

        <RequireRouteWrite>
          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm font-medium">{t("create_role")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("role_name")}</Label>
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. editor"
                  dir="ltr"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("permissions")}</Label>
                <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                  {allPermissions.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 py-0.5 text-sm">
                      <input
                        type="checkbox"
                        checked={newRolePerms.includes(perm)}
                        onChange={() => setNewRolePerms(togglePerm(newRolePerms, perm))}
                      />
                      <span className="font-mono">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <Button
              type="button"
              disabled={!newRoleName || createRole.isPending}
              onClick={() => createRole.mutate({ name: newRoleName, permissions: newRolePerms })}
            >
              {t("create_role")}
            </Button>
          </div>
        </RequireRouteWrite>
      </CardContent>

      <Dialog open={editingRole !== null} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCommon("edit")} — {editingRole?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("permissions")}</Label>
            <div className="max-h-60 overflow-y-auto rounded-md border p-2">
              {allPermissions.map((perm) => (
                <label key={perm} className="flex items-center gap-2 py-0.5 text-sm">
                  <input
                    type="checkbox"
                    checked={editPerms.includes(perm)}
                    onChange={() => setEditPerms(togglePerm(editPerms, perm))}
                  />
                  <span className="font-mono">{perm}</span>
                </label>
              ))}
            </div>
          </div>
          <Button
            type="button"
            disabled={!editingRole || updateRole.isPending}
            onClick={() => {
              if (!editingRole) return
              updateRole.mutate({ id: editingRole.id, permissions: editPerms })
            }}
          >
            {t("save")}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function UsersPage() {
  const t = useTranslations("users")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()

  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRole, setEditRole] = useState("")

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: UserRow[] }>("/api/v1/users"),
  })

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api<RolesResponse>("/api/v1/roles"),
  })

  const users = usersData?.users ?? []
  const roles = rolesData?.roles ?? []

  const create = useMutation({
    mutationFn: (body: {
      name: string
      username: string
      email?: string
      password: string
      password_confirmation: string
      role: string
    }) => api("/api/v1/users", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("create"))
      qc.invalidateQueries({ queryKey: ["users"] })
    },
    onError: toastMutationError,
  })

  const updateUser = useMutation({
    mutationFn: ({
      id,
      name,
      email,
      password,
      role,
    }: {
      id: number
      name: string
      email?: string
      password?: string
      role: string
    }) =>
      api(`/api/v1/users/${id}`, {
        method: "PATCH",
        json: {
          name,
          email: email || undefined,
          ...(password ? { password, password_confirmation: password } : {}),
          role,
        },
      }),
    onSuccess: () => {
      toast.success(t("save"))
      setEditingUser(null)
      qc.invalidateQueries({ queryKey: ["users"] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete"))
      qc.invalidateQueries({ queryKey: ["users"] })
    },
    onError: toastMutationError,
  })

  const columns: DataTableColumn<UserRow>[] = [
    {
      id: "name",
      header: t("name"),
      sortValue: (row) => row.name,
      cell: (u) => (
        <div>
          <p className="font-medium">{u.name}</p>
          <p className="text-muted-foreground font-mono text-xs" dir="ltr">
            {u.username}
            {u.email ? ` · ${u.email}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "role",
      header: t("role"),
      sortValue: (row) => row.roles[0]?.name ?? "",
      cell: (u) => (
        <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
          {u.roles[0]?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: (u) => (
        <RequireRouteWrite>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingUser(u)
                setEditName(u.name)
                setEditEmail(u.email ?? "")
                setEditPassword("")
                setEditRole(u.roles[0]?.name ?? "")
              }}
            >
              {t("edit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => remove.mutate(u.id)}
            >
              {t("delete")}
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
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const password = String(fd.get("password") ?? "")
                create.mutate({
                  name: String(fd.get("name")),
                  username: String(fd.get("username")),
                  email: String(fd.get("email") ?? "") || undefined,
                  password,
                  password_confirmation: password,
                  role: String(fd.get("role")),
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">{t("username")}</Label>
                <Input id="username" name="username" required dir="ltr" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" name="email" type="email" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t("role")}</Label>
                <select
                  id="role"
                  name="role"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  required
                >
                  {roles.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={create.isPending}>
                  {t("create")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>

          <DataTable
            columns={columns}
            data={users}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("search")}
            searchFilter={(row, q) =>
              row.name.toLowerCase().includes(q) ||
              row.username.toLowerCase().includes(q) ||
              (row.email ?? "").toLowerCase().includes(q)
            }
            emptyMessage={t("empty")}
          />
        </CardContent>
      </Card>

      <RolesCard />

      <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>{t("name")}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("email")}</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("password_optional")}</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                minLength={8}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("role")}</Label>
              <select
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            type="button"
            disabled={!editingUser || !editName || !editRole || updateUser.isPending}
            onClick={() => {
              if (!editingUser) return
              updateUser.mutate({
                id: editingUser.id,
                name: editName,
                email: editEmail,
                password: editPassword || undefined,
                role: editRole,
              })
            }}
          >
            {t("save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
