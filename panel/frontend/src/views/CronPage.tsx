"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type CronRow = {
  id: number
  schedule: string
  command: string
  status: string
  hosting_account_id: number | null
  hosting_account?: { id: number; username: string } | null
}

type AccountOption = {
  id: number
  username: string
}

export default function CronPage() {
  const t = useTranslations("cron")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: () => api<{ jobs: CronRow[] }>("/api/v1/cron/jobs"),
  })

  const { data: accountsData } = useQuery({
    queryKey: ["hosting-accounts"],
    queryFn: () => api<{ accounts: AccountOption[] }>("/api/v1/hosting/accounts"),
  })

  const jobs = data?.jobs ?? []

  const create = useMutation({
    mutationFn: (body: {
      schedule: string
      command: string
      hosting_account_id?: number
    }) => api("/api/v1/cron/jobs", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("add"))
      qc.invalidateQueries({ queryKey: ["cron-jobs"] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/cron/jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete"))
      qc.invalidateQueries({ queryKey: ["cron-jobs"] })
    },
    onError: toastMutationError,
  })

  const columns: DataTableColumn<CronRow>[] = [
    {
      id: "schedule",
      header: t("field_schedule"),
      sortValue: (row) => row.schedule,
      cell: (job) => (
        <span dir="ltr" className="font-mono">
          {job.schedule}
        </span>
      ),
    },
    {
      id: "command",
      header: t("field_command"),
      sortValue: (row) => row.command,
      cell: (job) => (
        <span dir="ltr" className="font-mono">
          {job.command}
        </span>
      ),
    },
    {
      id: "account",
      header: t("field_account"),
      sortValue: (row) => row.hosting_account?.username ?? "",
      cell: (job) => (
        <span className="text-muted-foreground">
          {job.hosting_account?.username ?? t("account_system")}
        </span>
      ),
    },
    {
      id: "status",
      header: t("status"),
      sortValue: (row) => row.status,
      cell: (job) => <span className="text-muted-foreground">{job.status}</span>,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: (job) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => remove.mutate(job.id)}
        >
          {t("delete")}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const accountId = String(fd.get("hosting_account_id") ?? "")
              create.mutate({
                schedule: String(fd.get("schedule") ?? ""),
                command: String(fd.get("command") ?? ""),
                hosting_account_id: accountId ? Number(accountId) : undefined,
              })
              e.currentTarget.reset()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="hosting_account_id">{t("field_account")}</Label>
              <select
                id="hosting_account_id"
                name="hosting_account_id"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                defaultValue=""
              >
                <option value="">{t("account_system")}</option>
                {(accountsData?.accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">{t("field_schedule")}</Label>
              <Input
                id="schedule"
                name="schedule"
                placeholder="0 2 * * *"
                required
                dir="ltr"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="command">{t("field_command")}</Label>
              <Input id="command" name="command" required dir="ltr" className="font-mono" />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {t("add")}
              </Button>
            </div>
          </form>
          <DataTable
            columns={columns}
            data={jobs}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            searchPlaceholder={t("search")}
            searchFilter={(row, q) =>
              row.schedule.toLowerCase().includes(q) ||
              row.command.toLowerCase().includes(q) ||
              (row.hosting_account?.username ?? "").toLowerCase().includes(q)
            }
            emptyMessage={t("empty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
