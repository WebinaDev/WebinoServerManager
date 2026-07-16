"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"

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

export default function ForgotPasswordPage() {
  const t = useTranslations("auth")
  const tCommon = useTranslations("common")
  const [username, setUsername] = useState("")
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<{ data: { configured: boolean } }>("/api/v1/mail/status")
      .then((r) => {
        if (!cancelled) setMailConfigured(r.data.configured)
      })
      .catch(() => {
        if (!cancelled) setMailConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)
    try {
      const res = await api<{ message: string }>("/api/v1/auth/forgot-password", {
        method: "POST",
        json: { username: username.trim() },
      })
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error_generic"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("forgot_title")}</CardTitle>
          <CardDescription>{t("forgot_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mailConfigured === false ? (
            <p className="text-muted-foreground text-sm">{t("forgot_no_mail")}</p>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-green-600 dark:text-green-400" role="status">
              {message}
            </p>
          ) : null}
          <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="grid gap-2">
              <Label htmlFor="username">{t("username")}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                dir="ltr"
                className="font-mono"
                required
              />
            </div>
            <Button type="submit" disabled={pending || mailConfigured === false}>
              {t("forgot_submit")}
            </Button>
          </form>
          <p className="text-center text-sm">
            <Link href="/login" className="underline-offset-4 hover:underline">
              {t("back_to_login")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
