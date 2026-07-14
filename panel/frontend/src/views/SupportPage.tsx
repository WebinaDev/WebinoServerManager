"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { useLocale } from "@/hooks/useLocale"
import { api } from "@/lib/api"

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
  const { t } = useTranslation(["support", "common"])
  const { formatDateTime } = useLocale()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => api<{ tickets: TicketRow[] }>("/api/v1/support/tickets"),
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
      qc.invalidateQueries({ queryKey: ["support-tickets"] })
    },
  })

  const reply = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api(`/api/v1/support/tickets/${id}/replies`, { method: "POST", json: { body } }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] })
      qc.invalidateQueries({ queryKey: ["support-ticket", vars.id] })
    },
  })

  const close = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/support/tickets/${id}/close`, { method: "POST" }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] })
      qc.invalidateQueries({ queryKey: ["support-ticket", id] })
    },
  })

  const ticket = detail?.ticket

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("support:title")}</CardTitle>
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
                <Label htmlFor="subject">{t("support:field_subject")}</Label>
                <Input id="subject" name="subject" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">{t("support:field_priority")}</Label>
                <select
                  id="priority"
                  name="priority"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue="normal"
                >
                  <option value="low">{t("support:priority_low")}</option>
                  <option value="normal">{t("support:priority_normal")}</option>
                  <option value="high">{t("support:priority_high")}</option>
                  <option value="urgent">{t("support:priority_urgent")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">{t("support:field_body")}</Label>
                <Textarea id="body" name="body" required rows={4} />
              </div>
              <Button type="submit" disabled={create.isPending}>
                {t("support:create")}
              </Button>
            </form>
          </RequireRouteWrite>

          {isLoading ? (
            <p>{t("common:loading")}</p>
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
                      <p className="text-muted-foreground text-sm whitespace-pre-wrap">{ticket.body}</p>
                      <ul className="space-y-2">
                        {ticket.replies.map((r) => (
                          <li key={r.id} className="bg-muted/40 rounded-md p-3 text-sm">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-medium">{r.author}</p>
                              <p className="text-muted-foreground text-xs">{formatDateTime(r.created_at)}</p>
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
                            <Textarea name="reply" rows={3} placeholder={t("support:reply_placeholder")} />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={reply.isPending}>
                                {t("support:reply")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={close.isPending}
                                onClick={() => close.mutate(ticket.id)}
                              >
                                {t("support:close")}
                              </Button>
                            </div>
                          </form>
                        </RequireRouteWrite>
                      ) : (
                        <p className="text-muted-foreground text-sm">{t("support:closed_label")}</p>
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
