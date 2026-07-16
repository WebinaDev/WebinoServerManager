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
import { api } from "@/lib/api"
import { useLocale } from "@/hooks/useLocale"
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
  const t = useTranslations("webhooks")
  const tCommon = useTranslations("common")
  const tDns = useTranslations("dns")
  const { formatDateTime } = useLocale()
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
      toast.success(t("created"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/api/v1/webhooks/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      toast.success(t("updated"))
      setEditingEndpoint(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api(`/api/v1/webhooks/${id}`, { method: "PATCH", json: { enabled } }),
    onSuccess: () => {
      toast.success(t("updated"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("deleted"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const test = useMutation({
    mutationFn: (id: number) => api(`/api/v1/webhooks/${id}/test`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("test_sent"))
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
          <CardTitle>{t("create_title")}</CardTitle>
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
              <Label htmlFor="wh-name">{t("field_name")}</Label>
              <Input id="wh-name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">{t("field_url")}</Label>
              <Input id="wh-url" name="url" type="url" required dir="ltr" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="wh-secret">{t("field_secret")}</Label>
              <Input id="wh-secret" name="secret" dir="ltr" placeholder={t("secret_auto")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("field_events")}</Label>
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
                {t("create")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {endpoints.length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">{t("empty")}</li>
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
                      {ep.last_delivered_at ? (
                        <p className="text-muted-foreground text-xs">
                          {t("last_delivered")}: {formatDateTime(ep.last_delivered_at)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingEndpoint(ep)}
                      >
                        {tDns("edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={test.isPending}
                        onClick={() => test.mutate(ep.id)}
                      >
                        {t("test")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggle.mutate({ id: ep.id, enabled: !ep.enabled })}
                      >
                        {ep.enabled ? t("enabled") : t("disabled")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("delete_confirm"))) {
                            remove.mutate(ep.id)
                          }
                        }}
                      >
                        {t("delete")}
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
          <CardTitle>{t("deliveries_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {deliveries.length === 0 ? (
              <li className="text-muted-foreground px-4 py-3 text-sm">
                {t("deliveries_empty")}
              </li>
            ) : (
              deliveries.map((d) => (
                <li key={d.id} className="px-4 py-3 text-sm">
                  <span dir="ltr">
                    {d.event} · {d.status} · {d.response_code ?? "—"} · {formatDateTime(d.delivered_at)}
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
            <DialogTitle>{t("edit_title")}</DialogTitle>
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
                <Label htmlFor="edit-wh-name">{t("field_name")}</Label>
                <Input
                  id="edit-wh-name"
                  name="name"
                  required
                  defaultValue={editingEndpoint.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-wh-url">{t("field_url")}</Label>
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
                <Label htmlFor="edit-wh-secret">{t("field_secret")}</Label>
                <Input
                  id="edit-wh-secret"
                  name="secret"
                  dir="ltr"
                  placeholder={t("secret_unchanged")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("field_events")}</Label>
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
                {t("enabled")}
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingEndpoint(null)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {tCommon("save")}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
