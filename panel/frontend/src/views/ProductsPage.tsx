"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type ProductRow = { name?: string; version?: string }

export default function ProductsPage() {
  const { t } = useTranslation(["products", "common"])
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api<{ data?: ProductRow[] }>("/api/v1/products"),
  })

  const install = useMutation({
    mutationFn: (body: { product: string; channel?: string }) =>
      api("/api/v1/products/install", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  })

  const products = data?.data ?? []

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("products:title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="grid gap-3 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              install.mutate({
                product: String(fd.get("product") ?? "Webino"),
                channel: String(fd.get("channel") ?? "") || undefined,
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="product">{t("products:field_product")}</Label>
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
              <Label htmlFor="channel">{t("products:field_channel")}</Label>
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
                {t("products:install")}
              </Button>
            </div>
            </form>
          </RequireRouteWrite>
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {products.map((p, i) => (
                <li key={`${p.name ?? i}`} className="px-4 py-3 text-sm" dir="ltr">
                  {p.name} {p.version ? `· ${p.version}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
