"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type TwoFactorStatus = {
  enabled: boolean
  confirmed: boolean
  has_recovery_codes: boolean
}

type EnableResponse = {
  secret: string
  otpauth_url: string
}

type ConfirmResponse = {
  message: string
  recovery_codes: string[]
}

export default function TwoFactorSettingsPage() {
  const { t } = useTranslation(["security", "common"])
  const qc = useQueryClient()
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  const { data: status, isLoading } = useQuery({
    queryKey: ["2fa-status"],
    queryFn: () => api<TwoFactorStatus>("/api/v1/auth/2fa/status"),
  })

  const enable = useMutation({
    mutationFn: () => api<EnableResponse>("/api/v1/auth/2fa/enable", { method: "POST" }),
    onSuccess: (res) => {
      setOtpauthUrl(res.otpauth_url)
      setRecoveryCodes(null)
      qc.invalidateQueries({ queryKey: ["2fa-status"] })
    },
  })

  const confirm = useMutation({
    mutationFn: (otp: string) =>
      api<ConfirmResponse>("/api/v1/auth/2fa/confirm", {
        method: "POST",
        json: { otp },
      }),
    onSuccess: (res) => {
      setRecoveryCodes(res.recovery_codes)
      setOtpauthUrl(null)
      qc.invalidateQueries({ queryKey: ["2fa-status"] })
    },
  })

  const disable = useMutation({
    mutationFn: (body: { password: string; otp: string }) =>
      api("/api/v1/auth/2fa/disable", { method: "POST", json: body }),
    onSuccess: () => {
      setOtpauthUrl(null)
      setRecoveryCodes(null)
      qc.invalidateQueries({ queryKey: ["2fa-status"] })
    },
  })

  const enabled = status?.enabled ?? false

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("security:2fa_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p>{t("common:loading")}</p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                {enabled
                  ? t("security:2fa_enabled_desc")
                  : t("security:2fa_disabled_desc")}
              </p>

              {!enabled && !otpauthUrl && (
                <Button type="button" onClick={() => enable.mutate()} disabled={enable.isPending}>
                  {t("security:2fa_enable")}
                </Button>
              )}

              {otpauthUrl && (
                <div className="space-y-4 rounded-md border p-4">
                  <p className="text-sm">{t("security:2fa_scan_qr")}</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`}
                    alt={t("security:2fa_qr_alt")}
                    width={200}
                    height={200}
                    className="rounded border"
                  />
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const fd = new FormData(e.currentTarget)
                      confirm.mutate(String(fd.get("otp") ?? ""))
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="confirm-otp">{t("security:2fa_otp")}</Label>
                      <Input
                        id="confirm-otp"
                        name="otp"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        dir="ltr"
                        className="w-40"
                      />
                    </div>
                    <Button type="submit" disabled={confirm.isPending}>
                      {t("security:2fa_confirm")}
                    </Button>
                  </form>
                </div>
              )}

              {recoveryCodes && recoveryCodes.length > 0 && (
                <div className="space-y-3 rounded-md border border-amber-500/50 bg-amber-500/5 p-4">
                  <p className="text-sm font-medium">{t("security:2fa_recovery_codes")}</p>
                  <p className="text-muted-foreground text-xs">{t("security:2fa_recovery_hint")}</p>
                  <ul className="grid gap-1 font-mono text-sm md:grid-cols-2" dir="ltr">
                    {recoveryCodes.map((code) => (
                      <li key={code}>{code}</li>
                    ))}
                  </ul>
                </div>
              )}

              {enabled && (
                <form
                  className="grid max-w-md gap-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    disable.mutate({
                      password: String(fd.get("password") ?? ""),
                      otp: String(fd.get("otp") ?? ""),
                    })
                    e.currentTarget.reset()
                  }}
                >
                  <p className="text-sm font-medium">{t("security:2fa_disable")}</p>
                  <div className="space-y-2">
                    <Label htmlFor="disable-password">{t("security:2fa_password")}</Label>
                    <Input id="disable-password" name="password" type="password" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disable-otp">{t("security:2fa_otp")}</Label>
                    <Input
                      id="disable-otp"
                      name="otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      dir="ltr"
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={disable.isPending}>
                    {t("security:2fa_disable")}
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
