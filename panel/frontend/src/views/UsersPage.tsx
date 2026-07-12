"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type UserRow = {
  id: number
  name: string
  username: string
  email: string | null
  roles: { name: string }[]
}

type RoleRow = {
  name: string
}

export default function UsersPage() {
  const { t } = useTranslation(["users", "common"])
  const qc = useQueryClient()

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ users: UserRow[] }>("/api/v1/users"),
  })

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api<{ roles: RoleRow[] }>("/api/v1/roles"),
  })

  const create = useMutation({
    mutationFn: (body: {
      name: string
      username: string
      email?: string
      password: string
      password_confirmation: string
      role: string
    }) => api("/api/v1/users", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      api(`/api/v1/users/${id}`, { method: "PATCH", json: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })

  const roles = rolesData?.roles ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("users:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label htmlFor="name">{t("users:name")}</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{t("users:username")}</Label>
              <Input id="username" name="username" required dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("users:email")}</Label>
              <Input id="email" name="email" type="email" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("users:password")}</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">{t("users:role")}</Label>
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
                {t("users:create")}
              </Button>
            </div>
          </form>

          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(usersData?.users ?? []).map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-muted-foreground font-mono text-xs" dir="ltr">
                      {u.username}
                      {u.email ? ` · ${u.email}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                      value={u.roles[0]?.name ?? "viewer"}
                      onChange={(e) =>
                        updateRole.mutate({ id: u.id, role: e.target.value })
                      }
                    >
                      {roles.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove.mutate(u.id)}
                    >
                      {t("users:delete")}
                    </Button>
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
