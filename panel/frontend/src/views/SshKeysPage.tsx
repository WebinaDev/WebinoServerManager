"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type SshKeysData = {
  keys?: string[]
  path?: string
}

export default function SshKeysPage() {
  const { t } = useTranslation(["security", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["sshkeys"],
    queryFn: () => api<SshKeysData>("/api/v1/security/sshkeys"),
  })

  const addKey = useMutation({
    mutationFn: (body: { key: string; label?: string }) =>
      api("/api/v1/security/sshkeys", {
        method: "POST",
        json: { action: "add", ...body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sshkeys"] }),
  })

  const removeKey = useMutation({
    mutationFn: (key: string) =>
      api("/api/v1/security/sshkeys", {
        method: "POST",
        json: { action: "delete", key },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sshkeys"] }),
  })

  const keys = data?.keys ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("security:sshkeys_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.path && (
            <p className="text-muted-foreground text-sm" dir="ltr">
              {data.path}
            </p>
          )}
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              addKey.mutate({
                key: String(fd.get("key") ?? ""),
                label: String(fd.get("label") ?? "") || undefined,
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="ssh-key">{t("security:sshkeys_key")}</Label>
              <Input id="ssh-key" name="key" required dir="ltr" placeholder="ssh-ed25519 AAAA..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssh-label">{t("security:sshkeys_label")}</Label>
              <Input id="ssh-label" name="label" dir="ltr" placeholder="laptop" />
            </div>
            <Button type="submit" disabled={addKey.isPending}>
              {t("security:sshkeys_add")}
            </Button>
          </form>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {keys.length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">
                  {t("security:sshkeys_empty")}
                </li>
              ) : (
                keys.map((key) => (
                  <li
                    key={key}
                    className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <code className="break-all text-xs" dir="ltr">
                      {key}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={removeKey.isPending}
                      onClick={() => {
                        const prefix = key.split(/\s+/)[0] ?? key
                        if (window.confirm(t("security:sshkeys_delete_confirm"))) {
                          removeKey.mutate(prefix)
                        }
                      }}
                    >
                      {t("security:delete")}
                    </Button>
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
