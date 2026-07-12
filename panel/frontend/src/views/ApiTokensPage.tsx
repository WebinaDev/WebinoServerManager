"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type TokenRow = {
  id: number
  name: string
  abilities: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export default function ApiTokensPage() {
  const { t } = useTranslation(["tokens", "common"])
  const qc = useQueryClient()
  const [plaintext, setPlaintext] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () =>
      api<{ tokens: TokenRow[]; available_abilities: string[] }>("/api/v1/auth/tokens"),
  })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ token: string }>("/api/v1/auth/tokens", { method: "POST", json: body }),
    onSuccess: (res) => {
      setPlaintext(res.token)
      qc.invalidateQueries({ queryKey: ["api-tokens"] })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/auth/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-tokens"] }),
  })

  const abilities = data?.available_abilities ?? []
  const tokens = data?.tokens ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {plaintext ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{t("tokens:created_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">{t("tokens:created_hint")}</p>
            <pre className="bg-muted overflow-x-auto rounded p-3 text-xs" dir="ltr">
              {plaintext}
            </pre>
            <Button type="button" variant="outline" onClick={() => setPlaintext(null)}>
              {t("tokens:dismiss")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("tokens:create_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const selected = fd.getAll("abilities").map(String)
              const expires = String(fd.get("expires_at") ?? "")
              create.mutate({
                name: String(fd.get("name")),
                abilities: selected,
                ...(expires ? { expires_at: expires } : {}),
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="token-name">{t("tokens:field_name")}</Label>
              <Input id="token-name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-expires">{t("tokens:field_expires")}</Label>
              <Input id="token-expires" name="expires_at" type="datetime-local" dir="ltr" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("tokens:field_abilities")}</Label>
              <div className="flex flex-wrap gap-3">
                {abilities.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="abilities" value={a} className="rounded" />
                    <span dir="ltr">{a}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {t("tokens:create")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("tokens:list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {tokens.length === 0 ? (
                <li className="text-muted-foreground px-4 py-3 text-sm">{t("tokens:empty")}</li>
              ) : (
                tokens.map((tok) => (
                  <li
                    key={tok.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{tok.name}</p>
                      <p className="text-muted-foreground text-xs" dir="ltr">
                        {(tok.abilities ?? []).join(", ")}
                      </p>
                      {tok.expires_at ? (
                        <p className="text-muted-foreground text-xs">
                          {t("tokens:expires")}: {tok.expires_at}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(t("tokens:revoke_confirm"))) {
                          remove.mutate(tok.id)
                        }
                      }}
                    >
                      {t("tokens:revoke")}
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
