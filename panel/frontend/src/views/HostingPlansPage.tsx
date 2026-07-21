"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type PlanRow = {
  id: number
  name: string
  slug: string
  disk_mb: number
  bandwidth_mb: number
  inodes: number
  max_domains: number
  max_subdomains: number
  max_databases: number
  max_mailboxes: number
  max_ftp: number
  max_cron: number
  max_apps: number
  price: string | null
  enabled: boolean
}

type PlanForm = {
  name: string
  disk_mb: number
  bandwidth_mb: number
  inodes: number
  max_domains: number
  max_subdomains: number
  max_databases: number
  max_mailboxes: number
  max_ftp: number
  max_cron: number
  max_apps: number
  price: string
  enabled: boolean
}

const defaultPlan: PlanForm = {
  name: "",
  disk_mb: 1024,
  bandwidth_mb: 10240,
  inodes: 100000,
  max_domains: 1,
  max_subdomains: 5,
  max_databases: 2,
  max_mailboxes: 5,
  max_ftp: 2,
  max_cron: 5,
  max_apps: 5,
  price: "",
  enabled: true,
}

const PLAN_FIELDS = [
  ["name", "field_name"],
  ["disk_mb", "field_disk"],
  ["bandwidth_mb", "field_bandwidth"],
  ["inodes", "field_inodes"],
  ["max_domains", "field_max_domains"],
  ["max_subdomains", "field_max_subdomains"],
  ["max_databases", "field_max_databases"],
  ["max_mailboxes", "field_max_mailboxes"],
  ["max_ftp", "field_max_ftp"],
  ["max_cron", "field_max_cron"],
  ["max_apps", "field_max_apps"],
  ["price", "field_price"],
] as const

function planToForm(plan: PlanRow): PlanForm {
  return {
    name: plan.name,
    disk_mb: plan.disk_mb,
    bandwidth_mb: plan.bandwidth_mb,
    inodes: plan.inodes,
    max_domains: plan.max_domains,
    max_subdomains: plan.max_subdomains,
    max_databases: plan.max_databases,
    max_mailboxes: plan.max_mailboxes,
    max_ftp: plan.max_ftp,
    max_cron: plan.max_cron,
    max_apps: plan.max_apps ?? 5,
    price: plan.price ?? "",
    enabled: plan.enabled,
  }
}

function PlanFields({
  form,
  setForm,
  t,
}: {
  form: PlanForm
  setForm: (form: PlanForm) => void
  t: (key: string) => string
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {PLAN_FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label>{t(`${label}` as never)}</Label>
            <Input
              value={String(form[key])}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
        />
        {t("field_enabled")}
      </label>
    </>
  )
}

export default function HostingPlansPage() {
  const t = useTranslations("hosting")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [form, setForm] = useState(defaultPlan)
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null)
  const [editForm, setEditForm] = useState<PlanForm>(defaultPlan)

  const { data, isLoading } = useQuery({
    queryKey: ["hosting-plans"],
    queryFn: () => api<{ plans: PlanRow[] }>("/api/v1/hosting/plans"),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hosting-plans"] })

  const create = useMutation({
    mutationFn: (body: PlanForm) =>
      api("/api/v1/hosting/plans", {
        method: "POST",
        json: { ...body, price: body.price ? Number(body.price) : null },
      }),
    onSuccess: () => {
      toast.success(t("plan_saved"))
      invalidate()
      setForm(defaultPlan)
    },
    onError: toastMutationError,
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: PlanForm }) =>
      api(`/api/v1/hosting/plans/${id}`, {
        method: "PATCH",
        json: { ...body, price: body.price ? Number(body.price) : null },
      }),
    onSuccess: () => {
      toast.success(t("plan_saved"))
      invalidate()
      setEditingPlan(null)
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/hosting/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("plan_deleted"))
      invalidate()
    },
    onError: toastMutationError,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("plans_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <PlanFields form={form} setForm={setForm} t={t} />
            <Button
              onClick={() => create.mutate(form)}
              disabled={create.isPending || !form.name}
            >
              {t("create_plan")}
            </Button>
          </RequireRouteWrite>

          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.plans ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-muted-foreground">
                      {p.disk_mb} MB · {p.max_domains} domains · {p.max_databases} DB
                      {!p.enabled ? ` · ${t("disabled")}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingPlan(p)
                        setEditForm(planToForm(p))
                      }}
                    >
                      {tCommon("edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(t("delete_plan_confirm"))) remove.mutate(p.id)
                      }}
                    >
                      {tCommon("delete")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingPlan !== null} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("edit_plan")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <PlanFields form={editForm} setForm={setEditForm} t={t} />
            <div className="flex gap-2">
              <Button
                onClick={() => editingPlan && update.mutate({ id: editingPlan.id, body: editForm })}
                disabled={update.isPending || !editForm.name}
              >
                {tCommon("save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingPlan(null)}>
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
