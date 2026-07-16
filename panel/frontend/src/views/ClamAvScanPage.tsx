"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type ScanResult = {
  infected?: string[]
  count?: number
  output?: string
  ok?: boolean
}

export default function ClamAvScanPage() {
  const t = useTranslations("security")
  const tCommon = useTranslations("common")
  const [result, setResult] = useState<ScanResult | null>(null)

  const scan = useMutation({
    mutationFn: (path: string) =>
      api<ScanResult>("/api/v1/security/clamav/scan", {
        method: "POST",
        json: { path: path || "/" },
      }),
    onSuccess: (data) => setResult(data),
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("clamav_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 md:flex-row md:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              scan.mutate(String(fd.get("path") ?? "/"))
            }}
          >
            <div className="grow space-y-2">
              <Label htmlFor="scan-path">{t("clamav_path")}</Label>
              <Input id="scan-path" name="path" defaultValue="/" dir="ltr" />
            </div>
            <Button type="submit" disabled={scan.isPending}>
              {scan.isPending ? t("clamav_scanning") : t("clamav_scan")}
            </Button>
          </form>

          {result && (
            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm">
                {result.ok
                  ? t("clamav_clean")
                  : t("clamav_infected", { count: result.count ?? 0 })}
              </p>
              {(result.infected ?? []).length > 0 && (
                <ul className="list-inside list-disc text-sm" dir="ltr">
                  {result.infected!.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              )}
              {result.output && (
                <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs whitespace-pre-wrap" dir="ltr">
                  {result.output}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
