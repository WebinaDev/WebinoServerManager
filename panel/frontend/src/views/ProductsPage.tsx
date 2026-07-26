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

type ProductRow = { name?: string; version?: string; channel?: string }

type InstallResult = {
  ok?: boolean
  error?: string
  data?: unknown
  message?: string
  output?: string
}

function resultText(res: InstallResult | undefined): string {
  if (!res) return ""
  if (res.error) return String(res.error)
  if (res.message) return String(res.message)
  if (typeof res.output === "string") return res.output
  if (typeof res.data === "string") return res.data
  if (res.data != null) return JSON.stringify(res.data, null, 2)
  return JSON.stringify(res, null, 2)
}

export default function ProductsPage() {
  const t = useTranslations("products")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [lastResult, setLastResult] = useState<InstallResult | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api<{ data?: ProductRow[]; products?: ProductRow[] }>("/api/v1/products"),
  })

  const install = useMutation({
    mutationFn: (body: { product: string; channel?: string }) =>
      api<InstallResult>("/api/v1/products/install", { method: "POST", json: body }),
    onSuccess: (res) => {
      setLastResult(res)
      if (res?.ok === false) {
        toast.error(res.error || t("install_failed"))
      } else {
        toast.success(t("install_ok"))
      }
      qc.invalidateQueries({ queryKey: ["products"] })
    },
    onError: toastMutationError,
  })

  const products = data?.data ?? data?.products ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                setLastResult(null)
                install.mutate({
                  product: String(fd.get("product") ?? "Webino"),
                  channel: String(fd.get("channel") ?? "") || undefined,
                })
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="product">{t("field_product")}</Label>
                <select
                  id="product"
                  name="product"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue="Webino"
                >
                  <option value="Webino">Webino</option>
                  <option value="WebinoERM">WebinoERM</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">{t("field_channel")}</Label>
                <select
                  id="channel"
                  name="channel"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue="LTS"
                >
                  <option value="LTS">LTS</option>
                  <option value="Dev">Dev</option>
                  <option value="Beta">Beta</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={install.isPending}>
                  {install.isPending ? t("installing") : t("install")}
                </Button>
              </div>
            </form>
          </RequireRouteWrite>

          {lastResult ? (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">{t("last_result")}</p>
              <pre className="overflow-auto text-xs" dir="ltr">
                {resultText(lastResult)}
              </pre>
            </div>
          ) : null}

          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : products.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {products.map((p, i) => (
                <li key={`${p.name ?? i}`} className="px-4 py-3 text-sm" dir="ltr">
                  {p.name} {p.version ? `· ${p.version}` : ""}
                  {p.channel ? ` · ${p.channel}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
