"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

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

const EVENTS = [
  "backup.completed",
  "ssl.expiring",
  "alert.fired",
  "user.created",
] as const

type EndpointRow = {
  id: number
  name: string
  url: string
  events: string[]
  enabled: boolean
  last_status?: string | null
  last_delivered_at?: string | null
}

type DeliveryRow = {
  id: number
  endpoint_id: number
  event: string
  status: string
  response_code: number | null
  delivered_at: string
}

export default function WebhooksPage() {
  const { t } = useTranslation(["webhooks", "common", "dns"])
  const qc = useQueryClient()
  const [editingEndpoint, setEditingEndpoint] = useState<EndpointRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () =>
      api<{ endpoints: EndpointRow[]; available_events: string[] }>("/api/v1/webhooks"),
  })

  const { data: deliveriesData } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: () => api<{ deliveries: DeliveryRow[] }>("/api/v1/webhooks/deliveries"),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["webhooks"] })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/webhooks", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("webhooks:created", { defaultValue: "Webhook created" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/api/v1/webhooks/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      toast.success(t("webhooks:updated", { defaultValue: "Webhook updated" }))
      setEditingEndpoint(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api(`/api/v1/webhooks/${id}`, { method: "PATCH", json: { enabled } }),
    onSuccess: () => {
      toast.success(t("webhooks:updated", { defaultValue: "Webhook updated" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("webhooks:deleted", { defaultValue: "Webhook deleted" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const test = useMutation({
    mutationFn: (id: number) => api(`/api/v1/webhooks/${id}/test`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("webhooks:test_sent", { defaultValue: "Test delivery sent" }))
      qc.invalidateQueries({ queryKey: ["webhook-deliveries"] })
    },
    onError: toastMutationError,
  })

  const endpoints = data?.endpoints ?? []
  const deliveries = deliveriesData?.deliveries ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("webhooks:create_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              create.mutate({
                name: String(fd.get("name")),
                url: String(fd.get("url")),
                secret: String(fd.get("secret") ?? "") || undefined,
                events: fd.getAll("events").map(String),
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="wh-name">{t("webhooks:field_name")}</Label>
              <Input id="wh-name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">{t("webhooks:field_url")}</Label>
              <Input id="wh-url" name="url" type="url" required dir="ltr" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="wh-secret">{t("webhooks:field_secret")}</Label>
              <Input id="wh-secret" name="secret" dir="ltr" placeholder={t("webhooks:secret_auto")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("webhooks:field_events")}</Label>
              <div className="flex flex-wrap gap-3">
                {EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="events" value={ev} className="rounded" />
                    <span dir="ltr">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {t("webhooks:create")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("webhooks:list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {endpoints.length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">{t("webhooks:empty")}</li>
              ) : (
                endpoints.map((ep) => (
                  <li
                    key={ep.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{ep.name}</p>
                      <p className="text-muted-foreground text-xs" dir="ltr">
                        {ep.url}
                      </p>
                      <p className="text-muted-foreground text-xs" dir="ltr">
                        {(ep.events ?? []).join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingEndpoint(ep)}
                      >
                        {t("dns:edit", { defaultValue: "Edit" })}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={test.isPending}
                        onClick={() => test.mutate(ep.id)}
                      >
                        {t("webhooks:test")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggle.mutate({ id: ep.id, enabled: !ep.enabled })}
                      >
                        {ep.enabled ? t("webhooks:enabled") : t("webhooks:disabled")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("webhooks:delete_confirm"))) {
                            remove.mutate(ep.id)
                          }
                        }}
                      >
                        {t("webhooks:delete")}
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("webhooks:deliveries_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {deliveries.length === 0 ? (
              <li className="text-muted-foreground px-4 py-3 text-sm">
                {t("webhooks:deliveries_empty")}
              </li>
            ) : (
              deliveries.map((d) => (
                <li key={d.id} className="px-4 py-3 text-sm">
                  <span dir="ltr">
                    {d.event} · {d.status} · {d.response_code ?? "—"} · {d.delivered_at}
                  </span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      <Dialog
        open={editingEndpoint !== null}
        onOpenChange={(open) => !open && setEditingEndpoint(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("webhooks:edit_title", { defaultValue: "Edit webhook" })}</DialogTitle>
          </DialogHeader>
          {editingEndpoint ? (
            <form
              key={editingEndpoint.id}
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const secret = String(fd.get("secret") ?? "")
                update.mutate({
                  id: editingEndpoint.id,
                  body: {
                    name: String(fd.get("name")),
                    url: String(fd.get("url")),
                    secret: secret || undefined,
                    events: fd.getAll("events").map(String),
                    enabled: fd.get("enabled") === "on",
                  },
                })
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-wh-name">{t("webhooks:field_name")}</Label>
                <Input
                  id="edit-wh-name"
                  name="name"
                  required
                  defaultValue={editingEndpoint.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-wh-url">{t("webhooks:field_url")}</Label>
                <Input
                  id="edit-wh-url"
                  name="url"
                  type="url"
                  required
                  dir="ltr"
                  defaultValue={editingEndpoint.url}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-wh-secret">{t("webhooks:field_secret")}</Label>
                <Input
                  id="edit-wh-secret"
                  name="secret"
                  dir="ltr"
                  placeholder={t("webhooks:secret_unchanged", {
                    defaultValue: "Leave empty to keep current secret",
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("webhooks:field_events")}</Label>
                <div className="flex flex-wrap gap-3">
                  {EVENTS.map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="events"
                        value={ev}
                        className="rounded"
                        defaultChecked={(editingEndpoint.events ?? []).includes(ev)}
                      />
                      <span dir="ltr">{ev}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="enabled"
                  className="rounded"
                  defaultChecked={editingEndpoint.enabled}
                />
                {t("webhooks:enabled")}
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingEndpoint(null)}
                >
                  {t("common:cancel")}
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {t("common:save")}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
