"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"

type AntispamData = {
  greylisting?: boolean
  antispam?: boolean
}

export default function AntispamPage() {
  const t = useTranslations("email")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["email-antispam"],
    queryFn: () => api<AntispamData>("/api/v1/email/antispam"),
  })

  const update = useMutation({
    mutationFn: (body: Partial<AntispamData>) =>
      api("/api/v1/email/antispam", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-antispam"] }),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("antispam_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <>
              <RequireRouteWrite>
                <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
                  <Label htmlFor="greylisting" className="cursor-pointer">
                    {t("antispam_greylisting")}
                  </Label>
                  <input
                    id="greylisting"
                    type="checkbox"
                    className="size-4"
                    checked={data?.greylisting ?? false}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ greylisting: e.target.checked })}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
                  <Label htmlFor="antispam" className="cursor-pointer">
                    {t("antispam_clamav")}
                  </Label>
                  <input
                    id="antispam"
                    type="checkbox"
                    className="size-4"
                    checked={data?.antispam ?? false}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ antispam: e.target.checked })}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => qc.invalidateQueries({ queryKey: ["email-antispam"] })}
                >
                  {tCommon("save")}
                </Button>
              </RequireRouteWrite>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
