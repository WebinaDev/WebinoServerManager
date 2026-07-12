"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"

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
  const { t } = useTranslation(["monitoring", "common"])
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["notification-channels"],
    queryFn: () => api<{ channels: ChannelRow[] }>("/api/v1/monitoring/channels"),
  })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/monitoring/channels", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-channels"] }),
  })

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api(`/api/v1/monitoring/channels/${id}`, { method: "PATCH", json: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-channels"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/monitoring/channels/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-channels"] }),
  })

  const test = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/monitoring/channels/${id}/test`, { method: "POST" }),
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
    </div>
  )
}
