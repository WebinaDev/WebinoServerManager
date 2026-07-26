"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type PackageRow = {
  id: number
  slug: string
  name: string
  category: string
  description: string | null
  version_label: string | null
  pinable: boolean
  host_status: string
  requires_website: boolean
}

type InstallRow = {
  id: number
  status: string
  log: string | null
  package?: { slug: string; name: string } | null
  created_at?: string
}

type PinRow = {
  id: number
  package_id: number
  package?: { slug: string; name: string } | null
}

type WebsiteOpt = { id: number; fqdn: string }

export default function SoftstorePage() {
  const t = useTranslations("softstore")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [websiteId, setWebsiteId] = useState("")

  const { data: packagesData, isLoading } = useQuery({
    queryKey: ["softstore-packages"],
    queryFn: () => api<{ packages: PackageRow[] }>("/api/v1/softstore/packages"),
    refetchInterval: 15_000,
  })

  const { data: installsData } = useQuery({
    queryKey: ["softstore-installs"],
    queryFn: () => api<{ installs: InstallRow[] }>("/api/v1/softstore/installs"),
    refetchInterval: 5_000,
  })

  const { data: pinsData } = useQuery({
    queryKey: ["softstore-pins"],
    queryFn: () => api<{ pins: PinRow[] }>("/api/v1/softstore/pins"),
  })

  const { data: websitesData } = useQuery({
    queryKey: ["websites"],
    queryFn: () => api<{ websites: WebsiteOpt[] }>("/api/v1/websites"),
  })

  const pinnedIds = new Set((pinsData?.pins ?? []).map((p) => p.package_id))

  const install = useMutation({
    mutationFn: (slug: string) => {
      const body: { website_id?: number } = {}
      if (websiteId) {
        body.website_id = Number(websiteId)
      }
      return api(`/api/v1/softstore/packages/${slug}/install`, {
        method: "POST",
        json: body,
      })
    },
    onSuccess: () => {
      toast.success(t("install_queued"))
      void qc.invalidateQueries({ queryKey: ["softstore-installs"] })
      void qc.invalidateQueries({ queryKey: ["softstore-packages"] })
    },
    onError: toastMutationError,
  })

  const pin = useMutation({
    mutationFn: (packageId: number) =>
      api("/api/v1/softstore/pins", { method: "POST", json: { package_id: packageId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["softstore-pins"] })
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] })
    },
    onError: toastMutationError,
  })

  const unpin = useMutation({
    mutationFn: (packageId: number) =>
      api(`/api/v1/softstore/pins/${packageId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["softstore-pins"] })
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] })
    },
    onError: toastMutationError,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2">
            <Label htmlFor="website_id">{t("website_for_cms")}</Label>
            <select
              id="website_id"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={websiteId}
              onChange={(e) => setWebsiteId(e.target.value)}
            >
              <option value="">{t("website_none")}</option>
              {(websitesData?.websites ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.fqdn}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(packagesData?.packages ?? []).map((pkg) => (
                <li
                  key={pkg.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{pkg.name}</div>
                    <p className="text-muted-foreground text-xs">
                      {pkg.category} · {pkg.host_status}
                      {pkg.version_label ? ` · ${pkg.version_label}` : ""}
                    </p>
                    {pkg.description ? (
                      <p className="text-muted-foreground mt-1 text-xs">{pkg.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pkg.pinable ? (
                      pinnedIds.has(pkg.id) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={unpin.isPending}
                          onClick={() => unpin.mutate(pkg.id)}
                        >
                          {t("unpin")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pin.isPending}
                          onClick={() => pin.mutate(pkg.id)}
                        >
                          {t("pin")}
                        </Button>
                      )
                    ) : null}
                    <RequireRouteWrite>
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          install.isPending ||
                          (pkg.requires_website && !websiteId)
                        }
                        onClick={() => install.mutate(pkg.slug)}
                      >
                        {t("install")}
                      </Button>
                    </RequireRouteWrite>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("installs_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {(installsData?.installs ?? []).length === 0 ? (
              <li className="text-muted-foreground px-4 py-3 text-sm">{t("installs_empty")}</li>
            ) : (
              (installsData?.installs ?? []).map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      {row.package?.name ?? row.package?.slug ?? `#${row.id}`}
                    </span>
                    <span className="text-muted-foreground">{row.status}</span>
                  </div>
                  {row.log ? (
                    <pre className="bg-muted mt-2 max-h-32 overflow-auto rounded p-2 text-xs" dir="ltr">
                      {row.log}
                    </pre>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
