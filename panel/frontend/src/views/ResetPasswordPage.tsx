"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

export default function ResetPasswordPage() {
  const { t } = useTranslation(["auth", "common"])
  const params = useSearchParams()
  const token = params?.get("token") ?? ""
  const email = params?.get("email") ?? ""
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)
    try {
      const res = await api<{ message: string }>("/api/v1/auth/reset-password", {
        method: "POST",
        json: {
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        },
      })
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common:error_generic"))
    } finally {
      setPending(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("auth:reset_title")}</CardTitle>
            <CardDescription>{t("auth:reset_invalid_link")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password" className="text-sm underline-offset-4 hover:underline">
              {t("auth:forgot_title")}
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("auth:reset_title")}</CardTitle>
          <CardDescription>{t("auth:reset_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-green-600 dark:text-green-400" role="status">
                {message}
              </p>
              <Link href="/login" className="underline-offset-4 hover:underline">
                {t("auth:back_to_login")}
              </Link>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
              <div className="grid gap-2">
                <Label htmlFor="email">{t("auth:email")}</Label>
                <Input id="email" type="email" value={email} readOnly dir="ltr" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{t("auth:password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password_confirmation">{t("auth:reset_confirm")}</Label>
                <Input
                  id="password_confirmation"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={pending}>
                {t("auth:reset_submit")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
