"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

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
  const t = useTranslations("email")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["email-queue"],
    queryFn: () => api<QueueData>("/api/v1/email/queue"),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["email-queue"] })

  const flush = useMutation({
    mutationFn: () => api("/api/v1/email/queue/flush", { method: "POST" }),
    onSuccess: () => {
      toast.success(t("queue_flushed"))
      invalidate()
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      api("/api/v1/email/queue", { method: "DELETE", json: { id } }),
    onSuccess: () => {
      toast.success(t("queue_entry_deleted"))
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
        header: t("queue_sender"),
        sortValue: (row) => row.sender,
        cell: (row) => (
          <span className="text-xs" dir="ltr">
            {row.sender}
          </span>
        ),
      },
      {
        id: "recipients",
        header: t("queue_recipients"),
        sortValue: (row) => row.recipients,
        cell: (row) => (
          <span className="text-muted-foreground text-xs" dir="ltr">
            {row.recipients}
          </span>
        ),
      },
      {
        id: "size",
        header: t("queue_size"),
        sortValue: (row) => row.size,
        cell: (row) => (
          <span className="text-muted-foreground text-xs" dir="ltr">
            {row.size}
          </span>
        ),
      },
      {
        id: "arrival",
        header: t("queue_arrival"),
        sortValue: (row) => row.arrival,
        cell: (row) => (
          <span className="text-muted-foreground text-xs" dir="ltr">
            {row.arrival}
          </span>
        ),
      },
      {
        id: "actions",
        header: tCommon("actions"),
        cell: (row) => (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  t("queue_delete_confirm"),
                )
              ) {
                remove.mutate(row.id)
              }
            }}
          >
            {t("delete")}
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
          <CardTitle>{t("queue_title")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={flush.isPending}
            onClick={() => {
              if (window.confirm(t("queue_flush_confirm"))) {
                flush.mutate()
              }
            }}
          >
            {t("queue_flush")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={columns}
            data={entries}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("queue_search")}
            searchFilter={(row, q) =>
              row.id.toLowerCase().includes(q) ||
              row.sender.toLowerCase().includes(q) ||
              row.recipients.toLowerCase().includes(q)
            }
            emptyMessage={t("queue_empty")}
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
