"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

type QueueEntry = {
  id: string
  size: string
  arrival: string
  sender: string
  recipients: string
}

type QueueData = {
  entries?: QueueEntry[]
  raw?: string
}

export default function MailQueuePage() {
  const { t } = useTranslation(["email", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["email-queue"],
    queryFn: () => api<QueueData>("/api/v1/email/queue"),
  })

  const flush = useMutation({
    mutationFn: () => api("/api/v1/email/queue/flush", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-queue"] }),
  })

  const entries = data?.entries ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{t("email:queue_title")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={flush.isPending}
            onClick={() => {
              if (window.confirm(t("email:queue_flush_confirm"))) {
                flush.mutate()
              }
            }}
          >
            {t("email:queue_flush")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <>
              <ul className="divide-y rounded-md border">
                {entries.length === 0 ? (
                  <li className="text-muted-foreground px-4 py-3 text-sm">
                    {t("email:queue_empty")}
                  </li>
                ) : (
                  entries.map((e) => (
                    <li key={e.id} className="space-y-1 px-4 py-3 text-sm" dir="ltr">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-mono">{e.id}</span>
                        <span className="text-muted-foreground">{e.size}</span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {e.sender} → {e.recipients}
                      </p>
                      <p className="text-muted-foreground text-xs">{e.arrival}</p>
                    </li>
                  ))
                )}
              </ul>
              {data?.raw && (
                <pre className="bg-muted max-h-48 overflow-auto rounded p-2 text-xs whitespace-pre-wrap" dir="ltr">
                  {data.raw}
                </pre>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
