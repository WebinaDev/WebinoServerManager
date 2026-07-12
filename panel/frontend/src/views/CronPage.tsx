"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

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
  const { t } = useTranslation(["cron", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: () => api<{ jobs: CronRow[] }>("/api/v1/cron/jobs"),
  })

  const { data: accountsData } = useQuery({
    queryKey: ["hosting-accounts"],
    queryFn: () => api<{ accounts: AccountOption[] }>("/api/v1/hosting/accounts"),
  })

  const create = useMutation({
    mutationFn: (body: {
      schedule: string
      command: string
      hosting_account_id?: number
    }) => api("/api/v1/cron/jobs", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cron-jobs"] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/cron/jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cron-jobs"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("cron:title")}</CardTitle>
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
              <Label htmlFor="hosting_account_id">{t("cron:field_account")}</Label>
              <select
                id="hosting_account_id"
                name="hosting_account_id"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                defaultValue=""
              >
                <option value="">{t("cron:account_system")}</option>
                {(accountsData?.accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">{t("cron:field_schedule")}</Label>
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
              <Label htmlFor="command">{t("cron:field_command")}</Label>
              <Input id="command" name="command" required dir="ltr" className="font-mono" />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {t("cron:add")}
              </Button>
            </div>
          </form>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.jobs ?? []).map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span dir="ltr" className="font-mono">
                    {job.schedule} {job.command}
                  </span>
                  <span className="text-muted-foreground">
                    {job.hosting_account?.username ?? t("cron:account_system")} · {job.status}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove.mutate(job.id)}
                  >
                    {t("cron:delete")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
