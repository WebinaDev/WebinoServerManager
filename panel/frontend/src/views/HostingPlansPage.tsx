"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

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
  price: string | null
  enabled: boolean
}

const defaultPlan = {
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
  price: "",
  enabled: true,
}

export default function HostingPlansPage() {
  const { t } = useTranslation(["hosting", "common"])
  const qc = useQueryClient()
  const [form, setForm] = useState(defaultPlan)

  const { data, isLoading } = useQuery({
    queryKey: ["hosting-plans"],
    queryFn: () => api<{ plans: PlanRow[] }>("/api/v1/hosting/plans"),
  })

  const create = useMutation({
    mutationFn: (body: typeof defaultPlan) =>
      api("/api/v1/hosting/plans", {
        method: "POST",
        json: { ...body, price: body.price ? Number(body.price) : null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hosting-plans"] })
      setForm(defaultPlan)
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/v1/hosting/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hosting-plans"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("hosting:plans_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
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
                ["price", "field_price"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{t(`hosting:${label}`)}</Label>
                <Input
                  value={String(form[key])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <Button
            onClick={() => create.mutate(form)}
            disabled={create.isPending || !form.name}
          >
            {t("hosting:create_plan")}
          </Button>

          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.plans ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-muted-foreground">
                      {p.disk_mb} MB · {p.max_domains} domains · {p.max_databases} DB
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm(t("hosting:delete_plan_confirm"))) remove.mutate(p.id)
                    }}
                  >
                    {t("common:delete")}
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
