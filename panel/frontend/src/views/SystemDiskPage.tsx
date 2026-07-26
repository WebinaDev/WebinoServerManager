"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toastMutationError } from "@/lib/toast"

type Tree = { path: string; bytes: number }

const CLEANUP_ALLOW = ["/var/tmp", "/tmp", "/var/cache/webino", "/var/lib/webino/tmp"]

export default function SystemDiskPage() {
  const t = useTranslations("system")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["system-disk"],
    queryFn: () => api<{ trees: Tree[] }>("/api/v1/system/disk"),
  })

  const cleanup = useMutation({
    mutationFn: (path: string) =>
      api("/api/v1/system/disk/cleanup", { method: "POST", json: { path } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["system-disk"] }),
    onError: toastMutationError,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("disk_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">{t("disk_description")}</p>
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="space-y-2">
              {(data?.trees ?? []).map((row) => (
                <li
                  key={row.path}
                  className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
                >
                  <div>
                    <div className="font-mono text-xs" dir="ltr">
                      {row.path}
                    </div>
                    <div className="text-muted-foreground">
                      {(row.bytes / (1024 * 1024)).toFixed(1)} MiB
                    </div>
                  </div>
                  {CLEANUP_ALLOW.includes(row.path) ? (
                    <RequireRouteWrite>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cleanup.isPending}
                        onClick={() => cleanup.mutate(row.path)}
                      >
                        {t("disk_cleanup")}
                      </Button>
                    </RequireRouteWrite>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
