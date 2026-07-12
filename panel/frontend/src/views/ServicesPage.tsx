"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

type ServiceRow = {
  name: string
  active: string
  enabled: string
}

function badgeClass(state: string, kind: "active" | "enabled") {
  const s = state.toLowerCase()
  if (kind === "active") {
    if (s === "active") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    if (s === "inactive" || s === "failed") return "bg-destructive/15 text-destructive"
  }
  if (s === "enabled") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
  return "bg-muted text-muted-foreground"
}

export default function ServicesPage() {
  const { t } = useTranslation(["monitoring", "common"])
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["monitoring-services"],
    queryFn: () => api<{ services: ServiceRow[] }>("/api/v1/monitoring/services"),
    refetchInterval: 30_000,
  })

  const action = useMutation({
    mutationFn: (body: { service: string; action: "start" | "stop" | "restart" }) =>
      api("/api/v1/monitoring/services/action", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring-services"] }),
  })

  const services = data?.services ?? []

  const runAction = (service: string, act: "start" | "stop" | "restart") => {
    if (!window.confirm(t("monitoring:service_confirm", { service, action: act }))) return
    action.mutate({ service, action: act })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("monitoring:services_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {services.map((svc) => (
                <li
                  key={svc.name}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" dir="ltr">
                      {svc.name}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${badgeClass(svc.active, "active")}`}
                    >
                      {svc.active}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${badgeClass(svc.enabled, "enabled")}`}
                    >
                      {svc.enabled}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={action.isPending}
                      onClick={() => runAction(svc.name, "start")}
                    >
                      {t("monitoring:start")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={action.isPending}
                      onClick={() => runAction(svc.name, "stop")}
                    >
                      {t("monitoring:stop")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={action.isPending}
                      onClick={() => runAction(svc.name, "restart")}
                    >
                      {t("monitoring:restart")}
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
