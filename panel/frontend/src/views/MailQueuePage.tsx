"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

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

  const invalidate = () => qc.invalidateQueries({ queryKey: ["email-queue"] })

  const flush = useMutation({
    mutationFn: () => api("/api/v1/email/queue/flush", { method: "POST" }),
    onSuccess: () => {
      toast.success(t("email:queue_flushed", { defaultValue: "Mail queue flushed" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      api("/api/v1/email/queue", { method: "DELETE", json: { id } }),
    onSuccess: () => {
      toast.success(t("email:queue_entry_deleted", { defaultValue: "Queue entry removed" }))
      invalidate()
    },
    onError: toastMutationError,
  })

  const entries = data?.entries ?? []

  const columns: DataTableColumn<QueueEntry>[] = useMemo(
    () => [
      {
        id: "id",
        header: "ID",
        sortValue: (row) => row.id,
        cell: (row) => (
          <span className="font-mono text-xs" dir="ltr">
            {row.id}
          </span>
        ),
      },
      {
        id: "sender",
        header: t("email:queue_sender", { defaultValue: "Sender" }),
        sortValue: (row) => row.sender,
        cell: (row) => (
          <span className="text-xs" dir="ltr">
            {row.sender}
          </span>
        ),
      },
      {
        id: "recipients",
        header: t("email:queue_recipients", { defaultValue: "Recipients" }),
        sortValue: (row) => row.recipients,
        cell: (row) => (
          <span className="text-muted-foreground text-xs" dir="ltr">
            {row.recipients}
          </span>
        ),
      },
      {
        id: "size",
        header: t("email:queue_size", { defaultValue: "Size" }),
        sortValue: (row) => row.size,
        cell: (row) => (
          <span className="text-muted-foreground text-xs" dir="ltr">
            {row.size}
          </span>
        ),
      },
      {
        id: "arrival",
        header: t("email:queue_arrival", { defaultValue: "Arrival" }),
        sortValue: (row) => row.arrival,
        cell: (row) => (
          <span className="text-muted-foreground text-xs" dir="ltr">
            {row.arrival}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("common:actions", { defaultValue: "Actions" }),
        cell: (row) => (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  t("email:queue_delete_confirm", {
                    defaultValue: "Remove this message from the queue?",
                  }),
                )
              ) {
                remove.mutate(row.id)
              }
            }}
          >
            {t("email:delete")}
          </Button>
        ),
      },
    ],
    [remove.isPending, t],
  )

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
          <DataTable
            columns={columns}
            data={entries}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("email:queue_search", { defaultValue: "Search queue…" })}
            searchFilter={(row, q) =>
              row.id.toLowerCase().includes(q) ||
              row.sender.toLowerCase().includes(q) ||
              row.recipients.toLowerCase().includes(q)
            }
            emptyMessage={t("email:queue_empty")}
          />
          {data?.raw ? (
            <pre
              className="bg-muted max-h-48 overflow-auto rounded p-2 text-xs whitespace-pre-wrap"
              dir="ltr"
            >
              {data.raw}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
