"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toastMutationError } from "@/lib/toast"

type Watch = { id: number; path: string; enabled: boolean; last_diff_count: number }

export default function SecurityTamperPage() {
  const t = useTranslations("security")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [path, setPath] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["security-tamper"],
    queryFn: () =>
      api<{ status: { has_baseline?: boolean }; watches: Watch[] }>("/api/v1/security/tamper"),
  })

  const add = useMutation({
    mutationFn: () =>
      api("/api/v1/security/tamper/watches", { method: "POST", json: { path } }),
    onSuccess: () => {
      setPath("")
      void qc.invalidateQueries({ queryKey: ["security-tamper"] })
    },
    onError: toastMutationError,
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/security/tamper/watches/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security-tamper"] }),
    onError: toastMutationError,
  })

  const baseline = useMutation({
    mutationFn: () => api("/api/v1/security/tamper/baseline", { method: "POST", json: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security-tamper"] }),
    onError: toastMutationError,
  })

  const scan = useMutation({
    mutationFn: () => api<{ count?: number }>("/api/v1/security/tamper/scan", { method: "POST", json: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["security-tamper"] }),
    onError: toastMutationError,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("tamper_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{t("tamper_description")}</p>
          <p className="text-sm">
            {t("tamper_baseline")}:{" "}
            {data?.status?.has_baseline ? t("enabled") : t("disabled")}
          </p>
          <RequireRouteWrite>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={baseline.isPending} onClick={() => baseline.mutate(undefined)}>
                {t("tamper_create_baseline")}
              </Button>
              <Button size="sm" disabled={scan.isPending} onClick={() => scan.mutate(undefined)}>
                {t("tamper_scan")}
              </Button>
            </div>
          </RequireRouteWrite>
          {scan.data?.count != null ? (
            <p className="text-sm">
              {t("tamper_diffs")}: {scan.data.count}
            </p>
          ) : null}
          {isLoading ? <p>{tCommon("loading")}</p> : null}
          <RequireRouteWrite>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-md"
                dir="ltr"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/var/www/..."
              />
              <Button size="sm" disabled={!path || add.isPending} onClick={() => add.mutate(undefined)}>
                {t("tamper_add_watch")}
              </Button>
            </div>
          </RequireRouteWrite>
          <ul className="space-y-2 text-sm">
            {(data?.watches ?? []).map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 border-b py-2">
                <span className="font-mono text-xs" dir="ltr">
                  {w.path}
                </span>
                <RequireRouteWrite>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(w.id)}>
                    {t("delete")}
                  </Button>
                </RequireRouteWrite>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
