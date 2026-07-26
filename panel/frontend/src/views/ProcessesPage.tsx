"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toastMutationError } from "@/lib/toast"

type Proc = {
  pid: number
  user: string
  cpu: number
  mem: number
  command: string
}

export default function ProcessesPage() {
  const t = useTranslations("monitoring")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["monitoring-processes"],
    queryFn: () => api<{ processes: Proc[] }>("/api/v1/monitoring/processes?limit=30"),
    refetchInterval: 10_000,
  })

  const kill = useMutation({
    mutationFn: (body: { pid: number; signal: string }) =>
      api("/api/v1/monitoring/processes/kill", { method: "POST", json: body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["monitoring-processes"] }),
    onError: toastMutationError,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("processes_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(data?.processes ?? []).map((p) => (
                <li
                  key={p.pid}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium font-mono" dir="ltr">
                      {p.pid} · {p.command}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {p.user} · CPU {p.cpu}% · MEM {p.mem}%
                    </p>
                  </div>
                  <RequireRouteWrite>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={kill.isPending}
                        onClick={() => kill.mutate({ pid: p.pid, signal: "TERM" })}
                      >
                        {t("kill_term")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={kill.isPending}
                        onClick={() => {
                          if (window.confirm(t("kill_confirm"))) {
                            kill.mutate({ pid: p.pid, signal: "KILL" })
                          }
                        }}
                      >
                        {t("kill_kill")}
                      </Button>
                    </div>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
