"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type BackupRow = {
  id: number
  type: string
  target: string
  filename: string
  size: number
  status: string
  trigger?: string
  checksum?: string | null
  verified_at?: string | null
  restore_status?: string | null
}

type ScheduleRow = {
  id: number
  name: string
  type: string
  target: string
  frequency: string
  retention_days: number
  target_id?: number | null
  mode?: string
  enabled: boolean
  last_run_at: string | null
}

type TargetRow = {
  id: number
  name: string
  driver: string
  config: Record<string, string>
  enabled: boolean
}

export default function BackupsPage() {
  const { t } = useTranslation(["backups", "common"])
  const qc = useQueryClient()
  const [restoreTarget, setRestoreTarget] = useState<Record<number, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => api<{ backups: BackupRow[] }>("/api/v1/backups"),
  })

  const { data: schedulesData } = useQuery({
    queryKey: ["backup-schedules"],
    queryFn: () => api<{ schedules: ScheduleRow[] }>("/api/v1/backups/schedules"),
  })

  const { data: targetsData } = useQuery({
    queryKey: ["backup-targets"],
    queryFn: () => api<{ targets: TargetRow[] }>("/api/v1/backups/targets"),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["backups"] })
    qc.invalidateQueries({ queryKey: ["backup-schedules"] })
    qc.invalidateQueries({ queryKey: ["backup-targets"] })
  }

  const create = useMutation({
    mutationFn: (body: { type: string; target: string; target_id?: number }) =>
      api("/api/v1/backups", { method: "POST", json: body }),
    onSuccess: invalidate,
  })

  const createSchedule = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/backups/schedules", { method: "POST", json: body }),
    onSuccess: invalidate,
  })

  const createTarget = useMutation({
    mutationFn: (body: { name: string; driver: string; config: Record<string, string> }) =>
      api("/api/v1/backups/targets", { method: "POST", json: body }),
    onSuccess: invalidate,
  })

  const toggleSchedule = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api(`/api/v1/backups/schedules/${id}`, { method: "PATCH", json: { enabled } }),
    onSuccess: invalidate,
  })

  const removeSchedule = useMutation({
    mutationFn: (id: number) => api(`/api/v1/backups/schedules/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  const removeTarget = useMutation({
    mutationFn: (id: number) => api(`/api/v1/backups/targets/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  const restore = useMutation({
    mutationFn: ({ id, restore_target }: { id: number; restore_target: string }) =>
      api(`/api/v1/backups/${id}/restore`, { method: "POST", json: { restore_target } }),
    onSuccess: invalidate,
  })

  const verify = useMutation({
    mutationFn: (id: number) => api(`/api/v1/backups/${id}/verify`, { method: "POST" }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/backups/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })

  const targets = targetsData?.targets ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("backups:targets_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createTarget.mutate({
                  name: String(fd.get("target_name")),
                  driver: String(fd.get("driver")),
                  config: {
                    repo: String(fd.get("repo") ?? ""),
                    password: String(fd.get("password") ?? ""),
                    bucket: String(fd.get("bucket") ?? ""),
                    host: String(fd.get("host") ?? ""),
                    path: String(fd.get("path") ?? ""),
                    url: String(fd.get("url") ?? ""),
                  },
                })
                e.currentTarget.reset()
              }}
            >
            <div className="space-y-2">
              <Label htmlFor="target_name">{t("backups:target_name")}</Label>
              <Input id="target_name" name="target_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver">{t("backups:target_driver")}</Label>
              <select id="driver" name="driver" className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm">
                <option value="s3">S3</option>
                <option value="sftp">SFTP</option>
                <option value="rest">REST</option>
                <option value="local">local</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="repo">{t("backups:target_repo")}</Label>
              <Input id="repo" name="repo" dir="ltr" className="font-mono" placeholder="s3:..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("backups:target_password")}</Label>
              <Input id="password" name="password" type="password" dir="ltr" />
            </div>
            <div className="flex items-end md:col-span-3">
              <Button type="submit" disabled={createTarget.isPending}>
                {t("backups:add_target")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          <ul className="divide-y rounded-md border">
            {targets.map((tgt) => (
              <li key={tgt.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {tgt.name} · {tgt.driver}
                </span>
                <RequireRouteWrite>
                  <Button size="sm" variant="outline" onClick={() => removeTarget.mutate(tgt.id)}>
                    {t("backups:delete")}
                  </Button>
                </RequireRouteWrite>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("backups:schedules_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createSchedule.mutate({
                  name: String(fd.get("name")),
                  type: String(fd.get("type")),
                  target: String(fd.get("target")),
                  frequency: String(fd.get("frequency")),
                  retention_days: Number(fd.get("retention_days") || 7),
                  target_id: fd.get("target_id") ? Number(fd.get("target_id")) : undefined,
                  mode: String(fd.get("mode") ?? "full"),
                })
                e.currentTarget.reset()
              }}
            >
            <div className="space-y-2">
              <Label htmlFor="sched-name">{t("backups:schedule_name")}</Label>
              <Input id="sched-name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-type">{t("backups:field_type")}</Label>
              <select id="sched-type" name="type" className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm" defaultValue="files">
                <option value="files">{t("backups:type_files")}</option>
                <option value="db">{t("backups:type_db")}</option>
                <option value="full">{t("backups:type_full")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-target">{t("backups:field_target")}</Label>
              <Input id="sched-target" name="target" required dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_id">{t("backups:offsite_target")}</Label>
              <select id="target_id" name="target_id" className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm">
                <option value="">{t("backups:no_target")}</option>
                {targets.map((tgt) => (
                  <option key={tgt.id} value={tgt.id}>
                    {tgt.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mode">{t("backups:mode")}</Label>
              <select id="mode" name="mode" className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm" defaultValue="full">
                <option value="full">{t("backups:mode_full")}</option>
                <option value="incremental">{t("backups:mode_incremental")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">{t("backups:frequency")}</Label>
              <select id="frequency" name="frequency" className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm" defaultValue="daily">
                <option value="hourly">hourly</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention_days">{t("backups:retention_days")}</Label>
              <Input id="retention_days" name="retention_days" type="number" defaultValue={7} min={1} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createSchedule.isPending}>
                {t("backups:create_schedule")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          <ul className="divide-y rounded-md border">
            {(schedulesData?.schedules ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {s.frequency} · {s.type} · {s.mode ?? "full"} · {s.target}
                  </p>
                </div>
                <RequireRouteWrite>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleSchedule.mutate({ id: s.id, enabled: !s.enabled })}>
                      {s.enabled ? t("backups:enabled") : t("backups:disabled")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => removeSchedule.mutate(s.id)}>
                      {t("backups:delete")}
                    </Button>
                  </div>
                </RequireRouteWrite>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("backups:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                create.mutate({
                  type: String(fd.get("type") ?? "files"),
                  target: String(fd.get("target") ?? ""),
                  target_id: fd.get("backup_target_id") ? Number(fd.get("backup_target_id")) : undefined,
                })
                e.currentTarget.reset()
              }}
            >
            <div className="space-y-2">
              <Label htmlFor="type">{t("backups:field_type")}</Label>
              <select id="type" name="type" className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm" defaultValue="files">
                <option value="files">{t("backups:type_files")}</option>
                <option value="db">{t("backups:type_db")}</option>
                <option value="full">{t("backups:type_full")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">{t("backups:field_target")}</Label>
              <Input id="target" name="target" required dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup_target_id">{t("backups:offsite_target")}</Label>
              <select id="backup_target_id" name="backup_target_id" className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm">
                <option value="">{t("backups:no_target")}</option>
                {targets.map((tgt) => (
                  <option key={tgt.id} value={tgt.id}>
                    {tgt.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {t("backups:create")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.backups ?? []).map((b) => (
                <li key={b.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {b.type} · {b.target}
                        {b.trigger ? ` (${b.trigger})` : ""}
                      </p>
                      <p className="text-muted-foreground font-mono text-xs" dir="ltr">
                        {b.filename}
                      </p>
                      {b.checksum ? (
                        <p className="text-muted-foreground text-xs font-mono" dir="ltr">
                          sha256: {b.checksum.slice(0, 16)}…
                          {b.verified_at ? ` · ${t("backups:verified")}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground">
                      {b.size} B · {b.status}
                      {b.restore_status ? ` · restore: ${b.restore_status}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RequireRouteWrite>
                      <Input
                        className="h-8 max-w-xs font-mono text-xs"
                        dir="ltr"
                        placeholder={t("backups:restore_target")}
                        value={restoreTarget[b.id] ?? ""}
                        onChange={(e) =>
                          setRestoreTarget((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restore.isPending || !restoreTarget[b.id]}
                        onClick={() =>
                          restore.mutate({ id: b.id, restore_target: restoreTarget[b.id] ?? "" })
                        }
                      >
                        {t("backups:restore")}
                      </Button>
                      <Button size="sm" variant="outline" disabled={verify.isPending} onClick={() => verify.mutate(b.id)}>
                        {t("backups:verify")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove.mutate(b.id)}>
                        {t("backups:delete")}
                      </Button>
                    </RequireRouteWrite>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/v1/backups/${b.id}/download`}>{t("backups:download")}</a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
