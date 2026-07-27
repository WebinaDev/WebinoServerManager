"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
  const [category, setCategory] = useState<string>("all")

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
  const categories = useMemo(() => {
    const set = new Set((packagesData?.packages ?? []).map((p) => p.category))
    return ["all", ...Array.from(set).sort()]
  }, [packagesData?.packages])

  const filtered = useMemo(() => {
    const rows = packagesData?.packages ?? []
    if (category === "all") return rows
    return rows.filter((p) => p.category === category)
  }, [packagesData?.packages, category])

  const queueAction = useMutation({
    mutationFn: ({ slug, action }: { slug: string; action: "install" | "upgrade" | "uninstall" }) => {
      const body: { website_id?: number } = {}
      if (websiteId) {
        body.website_id = Number(websiteId)
      }
      return api(`/api/v1/softstore/packages/${slug}/${action}`, {
        method: "POST",
        json: body,
      })
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === "uninstall"
          ? t("uninstall_queued")
          : vars.action === "upgrade"
            ? t("upgrade_queued")
            : t("install_queued"),
      )
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

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                type="button"
                size="sm"
                variant={category === cat ? "default" : "outline"}
                onClick={() => setCategory(cat)}
              >
                {cat === "all" ? t("category_all") : cat}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {filtered.map((pkg) => {
                const installed = pkg.host_status === "installed"
                return (
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
                        {!installed ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              queueAction.isPending ||
                              (pkg.requires_website && !websiteId)
                            }
                            onClick={() =>
                              queueAction.mutate({ slug: pkg.slug, action: "install" })
                            }
                          >
                            {t("install")}
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                queueAction.isPending ||
                                (pkg.requires_website && !websiteId)
                              }
                              onClick={() =>
                                queueAction.mutate({ slug: pkg.slug, action: "upgrade" })
                              }
                            >
                              {t("upgrade")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={queueAction.isPending}
                              onClick={() =>
                                queueAction.mutate({ slug: pkg.slug, action: "uninstall" })
                              }
                            >
                              {t("uninstall")}
                            </Button>
                          </>
                        )}
                      </RequireRouteWrite>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("installs_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {(installsData?.installs ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("installs_empty")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {(installsData?.installs ?? []).map((row) => (
                <li key={row.id} className="px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <span>{row.package?.name ?? row.package?.slug ?? `#${row.id}`}</span>
                    <span className="text-muted-foreground">{row.status}</span>
                  </div>
                  {row.log ? (
                    <p className="text-muted-foreground mt-1 truncate text-xs" dir="ltr">
                      {row.log}
                    </p>
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
