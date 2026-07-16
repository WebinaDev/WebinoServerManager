"use client"

import { useTranslations, useLocale } from "next-intl"
import { useChangeLocale } from "@/i18n/changeLocale"
import { useState } from "react"
import { useSearchParams } from "next/navigation"

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
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { SkipLink } from "@/components/SkipLink"
import { useLocaleSync } from "@/hooks/useLocaleSync"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

type SetupForm = {
  name: string
  username: string
  email: string
  password: string
  password_confirmation: string
  default_locale: "fa" | "en"
  panel_name: string
  smtp_host: string
  smtp_port: string
  smtp_username: string
  smtp_password: string
  smtp_encryption: string
  smtp_from_address: string
  smtp_from_name: string
}

const initialForm: SetupForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  password_confirmation: "",
  default_locale: "fa",
  panel_name: "WebinoServer",
  smtp_host: "",
  smtp_port: "587",
  smtp_username: "",
  smtp_password: "",
  smtp_encryption: "tls",
  smtp_from_address: "",
  smtp_from_name: "",
}

export default function SetupWizardPage() {
  const t = useTranslations("setup")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  useLocaleSync()
  const searchParams = useSearchParams()
  const apiUnavailable = searchParams?.get("error") === "unavailable"
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<SetupForm>(initialForm)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function updateField<K extends keyof SetupForm>(key: K, value: SetupForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (!form.name.trim()) return t("errors_name_required")
      if (!form.username.trim()) return t("errors_username_required")
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(form.username)) {
        return t("errors_username_format")
      }
      if (form.password.length < 8) return t("errors_password_min")
      if (form.password !== form.password_confirmation) {
        return t("errors_password_mismatch")
      }
    }
    if (current === 1) {
      if (!form.panel_name.trim()) return t("errors_panel_name_required")
    }
    return null
  }

  function goNext() {
    const validationError = validateStep(step)
    if (validationError) {
      setErr(validationError)
      return
    }
    setErr(null)
    setStep((s) => s + 1)
  }

  async function submit() {
    const validationError = validateStep(1)
    if (validationError) {
      setErr(validationError)
      return
    }
    setErr(null)
    setPending(true)
    try {
      await api("/api/v1/setup", {
        method: "POST",
        json: {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim() || null,
          password: form.password,
          password_confirmation: form.password_confirmation,
          default_locale: form.default_locale,
          panel_name: form.panel_name.trim(),
          ...(form.smtp_host.trim()
            ? {
                smtp_host: form.smtp_host.trim(),
                smtp_port: Number(form.smtp_port) || 587,
                smtp_username: form.smtp_username.trim() || null,
                smtp_password: form.smtp_password || null,
                smtp_encryption: form.smtp_encryption || "tls",
                smtp_from_address: form.smtp_from_address.trim() || null,
                smtp_from_name: form.smtp_from_name.trim() || null,
              }
            : {}),
        },
      })
      changeLocale(form.default_locale)
      window.location.assign("/login")
    } catch (e) {
      setErr(e instanceof Error ? e.message : tCommon("error_generic"))
    } finally {
      setPending(false)
    }
  }

  const steps = [
    t("step_admin_label"),
    t("step_settings_label"),
    t("step_review_label"),
  ]

  return (
    <>
      <SkipLink href="#setup-main" labelKey="a11y_skip_to_setup" />
      <main
        id="setup-main"
        tabIndex={-1}
        className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 p-6 outline-none"
      >
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </div>
            <LocaleSwitcher />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ol className="text-muted-foreground flex flex-wrap gap-3 text-xs">
            {steps.map((label, i) => (
              <li
                key={label}
                className={cn(
                  i === step && "text-foreground font-medium",
                  i < step && "text-primary",
                )}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>

          {apiUnavailable ? (
            <p className="text-destructive text-sm" role="alert">
              {t("api_unavailable")}
            </p>
          ) : null}

          {err ? (
            <p className="text-destructive text-sm" role="alert">
              {err}
            </p>
          ) : null}

          {step === 0 ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("admin_name")}</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">{t("username")}</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  autoComplete="username"
                  dir="ltr"
                  className="font-mono"
                  required
                />
                <p className="text-muted-foreground text-xs">
                  {t("username_hint")}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t("email_optional")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  autoComplete="email"
                  dir="ltr"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password_confirmation">
                  {t("password_confirm")}
                </Label>
                <Input
                  id="password_confirmation"
                  type="password"
                  value={form.password_confirmation}
                  onChange={(e) =>
                    updateField("password_confirmation", e.target.value)
                  }
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="button" onClick={goNext}>
                {t("continue")}
              </Button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>{t("default_locale")}</Label>
                <div className="flex gap-2">
                  {(["fa", "en"] as const).map((locale) => (
                    <Button
                      key={locale}
                      type="button"
                      variant={
                        form.default_locale === locale ? "default" : "outline"
                      }
                      onClick={() => {
                        updateField("default_locale", locale)
                        changeLocale(locale)
                      }}
                    >
                      {t(`locale_${locale}`)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="panel_name">{t("panel_name")}</Label>
                <Input
                  id="panel_name"
                  value={form.panel_name}
                  onChange={(e) => updateField("panel_name", e.target.value)}
                  required
                />
              </div>
              <div className="rounded-md border p-4">
                <p className="mb-3 text-sm font-medium">{t("smtp_optional_title")}</p>
                <p className="text-muted-foreground mb-4 text-xs">
                  {t("smtp_optional_hint")}
                </p>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="smtp_host">{t("smtp_host")}</Label>
                    <Input
                      id="smtp_host"
                      value={form.smtp_host}
                      onChange={(e) => updateField("smtp_host", e.target.value)}
                      dir="ltr"
                      className="font-mono"
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="smtp_port">{t("smtp_port")}</Label>
                      <Input
                        id="smtp_port"
                        value={form.smtp_port}
                        onChange={(e) => updateField("smtp_port", e.target.value)}
                        dir="ltr"
                        className="font-mono"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="smtp_encryption">{t("smtp_encryption")}</Label>
                      <select
                        id="smtp_encryption"
                        value={form.smtp_encryption}
                        onChange={(e) => updateField("smtp_encryption", e.target.value)}
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                      >
                        <option value="tls">TLS</option>
                        <option value="ssl">SSL</option>
                        <option value="">None</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="smtp_username">{t("smtp_username")}</Label>
                      <Input
                        id="smtp_username"
                        value={form.smtp_username}
                        onChange={(e) => updateField("smtp_username", e.target.value)}
                        dir="ltr"
                        className="font-mono"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="smtp_password">{t("smtp_password")}</Label>
                      <Input
                        id="smtp_password"
                        type="password"
                        value={form.smtp_password}
                        onChange={(e) => updateField("smtp_password", e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="smtp_from_address">{t("smtp_from_address")}</Label>
                      <Input
                        id="smtp_from_address"
                        type="email"
                        value={form.smtp_from_address}
                        onChange={(e) => updateField("smtp_from_address", e.target.value)}
                        dir="ltr"
                        className="font-mono"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="smtp_from_name">{t("smtp_from_name")}</Label>
                      <Input
                        id="smtp_from_name"
                        value={form.smtp_from_name}
                        onChange={(e) => updateField("smtp_from_name", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(0)}
                >
                  {tCommon("back")}
                </Button>
                <Button type="button" onClick={goNext}>
                  {t("continue")}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                {t("review_hint")}
              </p>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("admin_name")}</dt>
                  <dd className="font-medium">{form.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("username")}</dt>
                  <dd className="font-mono font-medium" dir="ltr">
                    {form.username}
                  </dd>
                </div>
                {form.email ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t("email_optional")}</dt>
                    <dd className="font-mono" dir="ltr">
                      {form.email}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("default_locale")}</dt>
                  <dd>{t(`locale_${form.default_locale}`)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("panel_name")}</dt>
                  <dd className="font-medium">{form.panel_name}</dd>
                </div>
              </dl>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  {tCommon("back")}
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void submit()}
                >
                  {t("finish")}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </main>
    </>
  )
}
