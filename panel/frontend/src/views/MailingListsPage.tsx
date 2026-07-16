"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

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
  const { data, isLoading } = useQuery({
    queryKey: ["email-lists"],
    queryFn: () => api<{ lists: MailingList[] }>("/api/v1/email/lists"),
  })

  const create = useMutation({
    mutationFn: (body: { source: string; destinations: string[] }) =>
      api("/api/v1/email/lists", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-lists"] }),
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
                      → {list.destinations.join(", ")}
                    </p>
                    <span className="text-muted-foreground text-xs">{list.status}</span>
                  </div>
                  <RequireRouteWrite>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove.mutate(list.id)}
                    >
                      {t("delete")}
                    </Button>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
