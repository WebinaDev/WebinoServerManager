"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { useLocale } from "@/hooks/useLocale"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type TicketRow = {
  id: number
  subject: string
  body: string
  priority: string
  status: string
  replies_count?: number
}

type ReplyRow = {
  id: number
  author: string
  body: string
  created_at: string
}

type TicketDetail = TicketRow & {
  replies: ReplyRow[]
}

export default function SupportPage() {
  const t = useTranslations("support")
  const tCommon = useTranslations("common")
  const { formatDateTime } = useLocale()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [priorityFilter, setPriorityFilter] = useState<string>("")

  const { data, isLoading } = useQuery({
    queryKey: ["support-tickets", statusFilter, priorityFilter],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (statusFilter) qs.set("status", statusFilter)
      if (priorityFilter) qs.set("priority", priorityFilter)
      const q = qs.toString()
      return api<{ tickets: TicketRow[] }>(`/api/v1/support/tickets${q ? `?${q}` : ""}`)
    },
  })

  const { data: detail } = useQuery({
    queryKey: ["support-ticket", selectedId],
    queryFn: () => api<{ ticket: TicketDetail }>(`/api/v1/support/tickets/${selectedId}`),
    enabled: selectedId !== null,
  })

  const create = useMutation({
    mutationFn: (body: { subject: string; body: string; priority?: string }) =>
      api("/api/v1/support/tickets", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("created_ok"))
      qc.invalidateQueries({ queryKey: ["support-tickets"] })
    },
    onError: toastMutationError,
  })

  const reply = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api(`/api/v1/support/tickets/${id}/replies`, { method: "POST", json: { body } }),
    onSuccess: (_, vars) => {
      toast.success(t("reply_ok"))
      qc.invalidateQueries({ queryKey: ["support-tickets"] })
      qc.invalidateQueries({ queryKey: ["support-ticket", vars.id] })
    },
    onError: toastMutationError,
  })

  const close = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/support/tickets/${id}/close`, { method: "POST" }),
    onSuccess: (_, id) => {
      toast.success(t("closed_ok"))
      qc.invalidateQueries({ queryKey: ["support-tickets"] })
      qc.invalidateQueries({ queryKey: ["support-ticket", id] })
    },
    onError: toastMutationError,
  })

  const reopen = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/support/tickets/${id}/reopen`, { method: "POST" }),
    onSuccess: (_, id) => {
      toast.success(t("reopened_ok"))
      qc.invalidateQueries({ queryKey: ["support-tickets"] })
      qc.invalidateQueries({ queryKey: ["support-ticket", id] })
    },
    onError: toastMutationError,
  })

  const ticket = detail?.ticket

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        {t("internal_only_notice")}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate({
                  subject: String(fd.get("subject") ?? ""),
                  body: String(fd.get("body") ?? ""),
                  priority: String(fd.get("priority") ?? "normal"),
                })
                e.currentTarget.reset()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="subject">{t("field_subject")}</Label>
                <Input id="subject" name="subject" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">{t("field_priority")}</Label>
                <select
                  id="priority"
                  name="priority"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue="normal"
                >
                  <option value="low">{t("priority_low")}</option>
                  <option value="normal">{t("priority_normal")}</option>
                  <option value="high">{t("priority_high")}</option>
                  <option value="urgent">{t("priority_urgent")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">{t("field_body")}</Label>
                <Textarea id="body" name="body" required rows={4} />
              </div>
              <Button type="submit" disabled={create.isPending}>
                {t("create")}
              </Button>
            </form>
          </RequireRouteWrite>

          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label htmlFor="filter_status">{t("filter_status")}</Label>
              <select
                id="filter_status"
                className="border-input bg-background flex h-9 min-w-[8rem] rounded-md border px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">{t("filter_all")}</option>
                <option value="open">{t("status_open")}</option>
                <option value="closed">{t("status_closed")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter_priority">{t("filter_priority")}</Label>
              <select
                id="filter_priority"
                className="border-input bg-background flex h-9 min-w-[8rem] rounded-md border px-3 text-sm"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">{t("filter_all")}</option>
                <option value="low">{t("priority_low")}</option>
                <option value="normal">{t("priority_normal")}</option>
                <option value="high">{t("priority_high")}</option>
                <option value="urgent">{t("priority_urgent")}</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (data?.tickets ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.tickets ?? []).map((tk) => (
                <li key={tk.id}>
                  <button
                    type="button"
                    className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-start text-sm"
                    onClick={() => setSelectedId(tk.id === selectedId ? null : tk.id)}
                  >
                    <span className="font-medium">{tk.subject}</span>
                    <span className="text-muted-foreground">
                      {tk.status} · {tk.priority}
                      {tk.replies_count != null ? ` · ${tk.replies_count}` : ""}
                    </span>
                  </button>
                  {selectedId === tk.id && ticket ? (
                    <div className="space-y-3 border-t px-4 py-3">
                      <p className="text-muted-foreground whitespace-pre-wrap text-sm">{ticket.body}</p>
                      <ul className="space-y-2">
                        {ticket.replies.map((r) => (
                          <li key={r.id} className="bg-muted/40 rounded-md p-3 text-sm">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-medium">{r.author}</p>
                              <p className="text-muted-foreground text-xs">
                                {formatDateTime(r.created_at)}
                              </p>
                            </div>
                            <p className="whitespace-pre-wrap">{r.body}</p>
                          </li>
                        ))}
                      </ul>
                      {ticket.status !== "closed" ? (
                        <RequireRouteWrite>
                          <form
                            className="flex flex-col gap-2"
                            onSubmit={(e) => {
                              e.preventDefault()
                              const fd = new FormData(e.currentTarget)
                              const body = String(fd.get("reply") ?? "")
                              if (!body.trim()) return
                              reply.mutate({ id: ticket.id, body })
                              e.currentTarget.reset()
                            }}
                          >
                            <Textarea name="reply" rows={3} placeholder={t("reply_placeholder")} />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={reply.isPending}>
                                {t("reply")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={close.isPending}
                                onClick={() => close.mutate(ticket.id)}
                              >
                                {t("close")}
                              </Button>
                            </div>
                          </form>
                        </RequireRouteWrite>
                      ) : (
                        <RequireRouteWrite>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-muted-foreground text-sm">{t("closed_label")}</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={reopen.isPending}
                              onClick={() => reopen.mutate(ticket.id)}
                            >
                              {t("reopen")}
                            </Button>
                          </div>
                        </RequireRouteWrite>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
