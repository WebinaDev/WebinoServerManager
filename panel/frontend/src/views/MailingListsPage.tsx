"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

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

type MailingList = {
  id: number
  source: string
  destinations: string[]
  status: string
}

export default function MailingListsPage() {
  const t = useTranslations("email")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [editing, setEditing] = useState<MailingList | null>(null)
  const [memberEmail, setMemberEmail] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["email-lists"],
    queryFn: () => api<{ lists: MailingList[] }>("/api/v1/email/lists"),
  })

  const create = useMutation({
    mutationFn: (body: { source: string; destinations: string[] }) =>
      api("/api/v1/email/lists", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-lists"] }),
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { destinations: string[]; status?: string } }) =>
      api(`/api/v1/email/lists/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-lists"] })
      setEditing(null)
    },
    onError: toastMutationError,
  })

  const addMember = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) =>
      api<{ list: MailingList }>(`/api/v1/email/lists/${id}/members`, { method: "POST", json: { email } }),
    onSuccess: (list) => {
      setEditing(list.list)
      qc.invalidateQueries({ queryKey: ["email-lists"] })
      setMemberEmail("")
    },
    onError: toastMutationError,
  })

  const removeMember = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) =>
      api<{ list: MailingList }>(`/api/v1/email/lists/${id}/members`, { method: "DELETE", json: { email } }),
    onSuccess: (list) => {
      setEditing(list.list)
      qc.invalidateQueries({ queryKey: ["email-lists"] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/email/lists/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-lists"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("lists_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const destinations = String(fd.get("destinations") ?? "")
                  .split(/[,;\s]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                create.mutate({
                  source: String(fd.get("source") ?? ""),
                  destinations,
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="source">{t("field_source")}</Label>
                <Input id="source" name="source" type="email" required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destinations">{t("lists_destinations")}</Label>
                <Input
                  id="destinations"
                  name="destinations"
                  required
                  dir="ltr"
                  placeholder="user1@example.com, user2@example.com"
                />
              </div>
              <Button type="submit" disabled={create.isPending}>
                {t("lists_add")}
              </Button>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.lists ?? []).map((list) => (
                <li
                  key={list.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p dir="ltr" className="font-medium">
                      {list.source}
                    </p>
                    <p className="text-muted-foreground text-xs" dir="ltr">
                      {list.destinations.length} {t("lists_members")} · {list.status}
                    </p>
                  </div>
                  <RequireRouteWrite>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(list)}>
                        {tCommon("edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          update.mutate({
                            id: list.id,
                            body: {
                              destinations: list.destinations,
                              status: list.status === "active" ? "disabled" : "active",
                            },
                          })
                        }
                      >
                        {list.status === "active" ? t("lists_disable") : t("lists_enable")}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => remove.mutate(list.id)}>
                        {t("delete")}
                      </Button>
                    </div>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle dir="ltr">{editing?.source}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <ul className="divide-y rounded-md border text-sm">
                {editing.destinations.map((email) => (
                  <li key={email} className="flex items-center justify-between px-3 py-2" dir="ltr">
                    {email}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember.mutate({ id: editing.id, email })}
                    >
                      {t("lists_remove_member")}
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="member@example.com"
                  dir="ltr"
                />
                <Button
                  type="button"
                  onClick={() => addMember.mutate({ id: editing.id, email: memberEmail })}
                  disabled={!memberEmail}
                >
                  {t("lists_add_member")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
