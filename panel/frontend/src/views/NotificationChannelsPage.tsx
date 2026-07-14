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
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type ChannelRow = {
  id: number
  name: string
  type: string
  config: Record<string, string>
  enabled: boolean
}

function configPlaceholder(type: string): string {
  switch (type) {
    case "telegram":
      return '{"bot_token":"...","chat_id":"..."}'
    case "slack":
      return '{"webhook_url":"https://hooks.slack.com/..."}'
    case "webhook":
      return '{"url":"https://example.com/hook"}'
    case "email":
      return '{"email":"admin@example.com"}'
    default:
      return "{}"
  }
}

export default function NotificationChannelsPage() {
  const { t } = useTranslation(["monitoring", "common", "dns"])
  const qc = useQueryClient()
  const [editingChannel, setEditingChannel] = useState<ChannelRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["notification-channels"],
    queryFn: () => api<{ channels: ChannelRow[] }>("/api/v1/monitoring/channels"),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notification-channels"] })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/monitoring/channels", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("monitoring:channel_created", { defaultValue: "Channel created" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/api/v1/monitoring/channels/${id}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      toast.success(t("monitoring:channel_updated", { defaultValue: "Channel updated" }))
      setEditingChannel(null)
      invalidate()
    },
    onError: toastMutationError,
  })

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api(`/api/v1/monitoring/channels/${id}`, { method: "PATCH", json: { enabled } }),
    onSuccess: () => {
      toast.success(t("monitoring:channel_updated", { defaultValue: "Channel updated" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/monitoring/channels/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("monitoring:channel_deleted", { defaultValue: "Channel deleted" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const test = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/monitoring/channels/${id}/test`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("monitoring:channel_tested", { defaultValue: "Test notification sent" }))
    },
    onError: toastMutationError,
  })

  const channels = data?.channels ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("monitoring:channels_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const type = String(fd.get("type"))
              let config: Record<string, string> = {}
              try {
                config = JSON.parse(String(fd.get("config") ?? "{}")) as Record<string, string>
              } catch {
                toast.error(t("monitoring:invalid_config", { defaultValue: "Invalid JSON config" }))
                return
              }
              create.mutate({
                name: String(fd.get("name")),
                type,
                config,
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="channel-name">{t("monitoring:channel_name")}</Label>
              <Input id="channel-name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-type">{t("monitoring:channel_type")}</Label>
              <select
                id="channel-type"
                name="type"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                defaultValue="telegram"
              >
                <option value="telegram">Telegram</option>
                <option value="slack">Slack</option>
                <option value="webhook">Webhook</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="channel-config">{t("monitoring:channel_config")}</Label>
              <Textarea
                id="channel-config"
                name="config"
                dir="ltr"
                rows={3}
                defaultValue={configPlaceholder("telegram")}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {t("monitoring:add_channel")}
              </Button>
            </div>
          </form>

          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {channels.length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">
                  {t("monitoring:channels_empty")}
                </li>
              ) : (
                channels.map((ch) => (
                  <li
                    key={ch.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{ch.name}</p>
                      <p className="text-muted-foreground text-xs">{ch.type}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingChannel(ch)}
                      >
                        {t("dns:edit", { defaultValue: "Edit" })}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={test.isPending}
                        onClick={() => test.mutate(ch.id)}
                      >
                        {t("monitoring:test_channel")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggle.mutate({ id: ch.id, enabled: !ch.enabled })}
                      >
                        {ch.enabled ? t("monitoring:enabled") : t("monitoring:disabled")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("monitoring:delete_channel_confirm"))) {
                            remove.mutate(ch.id)
                          }
                        }}
                      >
                        {t("monitoring:delete")}
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editingChannel !== null}
        onOpenChange={(open) => !open && setEditingChannel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("monitoring:edit_channel", { defaultValue: "Edit notification channel" })}
            </DialogTitle>
          </DialogHeader>
          {editingChannel ? (
            <form
              key={editingChannel.id}
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                let config: Record<string, string> = {}
                try {
                  config = JSON.parse(String(fd.get("config") ?? "{}")) as Record<string, string>
                } catch {
                  toast.error(t("monitoring:invalid_config", { defaultValue: "Invalid JSON config" }))
                  return
                }
                update.mutate({
                  id: editingChannel.id,
                  body: {
                    name: String(fd.get("name")),
                    type: String(fd.get("type")),
                    config,
                    enabled: fd.get("enabled") === "on",
                  },
                })
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-channel-name">{t("monitoring:channel_name")}</Label>
                <Input
                  id="edit-channel-name"
                  name="name"
                  required
                  defaultValue={editingChannel.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-channel-type">{t("monitoring:channel_type")}</Label>
                <select
                  id="edit-channel-type"
                  name="type"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue={editingChannel.type}
                >
                  <option value="telegram">Telegram</option>
                  <option value="slack">Slack</option>
                  <option value="webhook">Webhook</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-channel-config">{t("monitoring:channel_config")}</Label>
                <Textarea
                  id="edit-channel-config"
                  name="config"
                  dir="ltr"
                  rows={4}
                  defaultValue={JSON.stringify(editingChannel.config ?? {}, null, 2)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="enabled"
                  className="rounded"
                  defaultChecked={editingChannel.enabled}
                />
                {t("monitoring:enabled")}
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingChannel(null)}>
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
