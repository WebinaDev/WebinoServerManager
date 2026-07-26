"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

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
  task_type: string
  task_config?: Record<string, string> | null
  notify_on_failure: boolean
  status: string
  hosting_account_id: number | null
  hosting_account?: { id: number; username: string } | null
}

type AccountOption = {
  id: number
  username: string
}

const TASK_TYPES = ["shell", "backup_site", "backup_db", "url_hit", "log_cut"] as const

export default function CronPage() {
  const t = useTranslations("cron")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [taskType, setTaskType] = useState<string>("shell")

  const { data, isLoading } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: () => api<{ jobs: CronRow[] }>("/api/v1/cron/jobs"),
  })

  const { data: scriptsData } = useQuery({
    queryKey: ["cron-scripts"],
    queryFn: () => api<{ scripts: Record<string, { label: string }> }>("/api/v1/cron/scripts"),
  })

  const { data: accountsData } = useQuery({
    queryKey: ["hosting-accounts"],
    queryFn: () => api<{ accounts: AccountOption[] }>("/api/v1/hosting/accounts"),
  })

  const jobs = data?.jobs ?? []

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/cron/jobs", { method: "POST", json: body }),
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

  const updateJob = useMutation({
    mutationFn: (body: { id: number; schedule: string; command: string; notify_on_failure: boolean }) =>
      api(`/api/v1/cron/jobs/${body.id}`, {
        method: "PATCH",
        json: {
          schedule: body.schedule,
          command: body.command,
          notify_on_failure: body.notify_on_failure,
        },
      }),
    onSuccess: () => {
      toast.success(t("updated"))
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
      id: "type",
      header: t("field_task_type"),
      sortValue: (row) => row.task_type,
      cell: (job) => <span className="text-muted-foreground">{job.task_type}</span>,
    },
    {
      id: "command",
      header: t("field_command"),
      sortValue: (row) => row.command,
      cell: (job) => (
        <span dir="ltr" className="font-mono text-xs">
          {job.command}
        </span>
      ),
    },
    {
      id: "notify",
      header: t("field_notify"),
      cell: (job) => (
        <span className="text-muted-foreground">{job.notify_on_failure ? tCommon("yes") : tCommon("no")}</span>
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
      id: "actions",
      header: tCommon("actions"),
      cell: (job) => (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const schedule = window.prompt(t("field_schedule"), job.schedule)
              if (!schedule) return
              const command = window.prompt(t("field_command"), job.command)
              if (!command) return
              updateJob.mutate({
                id: job.id,
                schedule,
                command,
                notify_on_failure: job.notify_on_failure,
              })
            }}
          >
            {tCommon("edit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => remove.mutate(job.id)}
          >
            {t("delete")}
          </Button>
        </div>
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
          {scriptsData?.scripts ? (
            <p className="text-muted-foreground text-sm">{t("script_library_hint")}</p>
          ) : null}
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const accountId = String(fd.get("hosting_account_id") ?? "")
              const type = String(fd.get("task_type") ?? "shell")
              const taskConfig: Record<string, string> = {}
              if (type === "backup_site") taskConfig.target = String(fd.get("target") ?? "")
              if (type === "backup_db") taskConfig.database = String(fd.get("database") ?? "")
              if (type === "url_hit") taskConfig.url = String(fd.get("url") ?? "")
              if (type === "log_cut") {
                taskConfig.path = String(fd.get("path") ?? "")
                taskConfig.keep_lines = String(fd.get("keep_lines") ?? "1000")
              }
              create.mutate({
                schedule: String(fd.get("schedule") ?? ""),
                command: type === "shell" ? String(fd.get("command") ?? "") : undefined,
                task_type: type,
                task_config: type === "shell" ? undefined : taskConfig,
                notify_on_failure: fd.get("notify_on_failure") === "on",
                hosting_account_id: accountId ? Number(accountId) : undefined,
              })
              e.currentTarget.reset()
              setTaskType("shell")
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="task_type">{t("field_task_type")}</Label>
              <select
                id="task_type"
                name="task_type"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {scriptsData?.scripts?.[type]?.label ?? type}
                  </option>
                ))}
              </select>
            </div>
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
              <Input id="schedule" name="schedule" placeholder="0 2 * * *" required dir="ltr" className="font-mono" />
            </div>
            {taskType === "shell" ? (
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="command">{t("field_command")}</Label>
                <Input id="command" name="command" required dir="ltr" className="font-mono" />
              </div>
            ) : null}
            {taskType === "backup_site" ? (
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="target">{t("field_target")}</Label>
                <Input id="target" name="target" required dir="ltr" />
              </div>
            ) : null}
            {taskType === "backup_db" ? (
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="database">{t("field_database")}</Label>
                <Input id="database" name="database" required dir="ltr" />
              </div>
            ) : null}
            {taskType === "url_hit" ? (
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="url">{t("field_url")}</Label>
                <Input id="url" name="url" required dir="ltr" />
              </div>
            ) : null}
            {taskType === "log_cut" ? (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="path">{t("field_log_path")}</Label>
                  <Input id="path" name="path" required dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keep_lines">{t("field_keep_lines")}</Label>
                  <Input id="keep_lines" name="keep_lines" defaultValue="1000" dir="ltr" />
                </div>
              </>
            ) : null}
            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <input type="checkbox" name="notify_on_failure" />
              {t("field_notify")}
            </label>
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
              row.task_type.toLowerCase().includes(q)
            }
            emptyMessage={t("empty")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
