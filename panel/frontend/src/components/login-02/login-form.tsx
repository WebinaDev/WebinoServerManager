"use client"

import { useState, type ComponentPropsWithoutRef, type FormEvent } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/providers/AppProviders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({
  className,
  ...props
}: ComponentPropsWithoutRef<"form">) {
  const { t } = useTranslation(["auth"])
  const { setToken } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [needsOtp, setNeedsOtp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await api("/api/v1/auth/login", {
        method: "POST",
        json: {
          username,
          password,
          ...(otp ? { otp } : {}),
          ...(recoveryCode ? { recovery_code: recoveryCode } : {}),
        },
      })
      setToken(null)
      window.location.assign("/")
    } catch (err) {
      if (err instanceof ApiError && err.data?.two_factor_required) {
        setNeedsOtp(true)
        setError(t("auth:two_factor_required"))
      } else {
        setError(err instanceof Error ? err.message : t("auth:errors_invalid"))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={(e) => void onSubmit(e)}
      {...props}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t("auth:loginTitle")}</h1>
        <p className="text-balance text-sm text-muted-foreground">
          {t("auth:loginSubtitle")}
        </p>
      </div>
      <div className="grid gap-6">
        {error ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="username">{t("auth:username")}</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
            dir="ltr"
            className="font-mono"
            required
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">{t("auth:password")}</Label>
            <Link
              href="/forgot-password"
              className="ms-auto text-sm underline-offset-4 hover:underline"
            >
              {t("auth:forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
        </div>
        {needsOtp ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="otp">{t("auth:otp")}</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(ev) => setOtp(ev.target.value)}
                dir="ltr"
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recovery">{t("auth:recovery_code")}</Label>
              <Input
                id="recovery"
                type="text"
                value={recoveryCode}
                onChange={(ev) => setRecoveryCode(ev.target.value)}
                dir="ltr"
                className="font-mono"
              />
            </div>
          </>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {t("auth:submit")}
        </Button>
      </div>
    </form>
  )
}
