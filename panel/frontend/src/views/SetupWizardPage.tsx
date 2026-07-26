"use client"

import { useTranslations, useLocale } from "next-intl"
import { useChangeLocale } from "@/i18n/changeLocale"
import { useCallback, useEffect, useState } from "react"
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
  hostname: string
  smtp_host: string
  smtp_port: string
  smtp_username: string
  smtp_password: string
  smtp_encryption: string
  smtp_from_address: string
  smtp_from_name: string
}

type StackForm = {
  webserver: "nginx" | "apache"
  database: "mariadb" | "mysql"
  php_versions: string[]
  redis: boolean
  memcached: boolean
  pureftpd: boolean
  skip: boolean
}

type StackStep = {
  id: number
  position: number
  slug: string
  label: string
  status: string
  log?: string | null
}

type StackStatus = {
  id: number
  status: string
  skip: boolean
  percent: number
  error?: string | null
  steps: StackStep[]
}

const initialForm: SetupForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  password_confirmation: "",
  default_locale: "fa",
  panel_name: "WebinoServer",
  hostname: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_username: "",
  smtp_password: "",
  smtp_encryption: "tls",
  smtp_from_address: "",
  smtp_from_name: "",
}

const initialStack: StackForm = {
  webserver: "nginx",
  database: "mariadb",
  php_versions: ["8.2", "8.3"],
  redis: false,
  memcached: false,
  pureftpd: false,
  skip: false,
}

const PHP_OPTIONS = ["8.1", "8.2", "8.3", "8.4"] as const

export default function SetupWizardPage() {
  const t = useTranslations("setup")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const changeLocale = useChangeLocale()
  useLocaleSync()
  const searchParams = useSearchParams()
  const apiUnavailable = searchParams?.get("error") === "unavailable"
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<SetupForm>({
    ...initialForm,
    default_locale: locale === "en" ? "en" : "fa",
  })
  const [stack, setStack] = useState<StackForm>(initialStack)
  const [stackStatus, setStackStatus] = useState<StackStatus | null>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function updateField<K extends keyof SetupForm>(key: K, value: SetupForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function togglePhp(ver: string) {
    setStack((prev) => {
      const has = prev.php_versions.includes(ver)
      const next = has
        ? prev.php_versions.filter((v) => v !== ver)
        : [...prev.php_versions, ver].sort()
      return { ...prev, php_versions: next, skip: false }
    })
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
    if (current === 2 && !stack.skip && stack.php_versions.length === 0) {
      return t("errors_php_required")
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

  const pollStack = useCallback(async () => {
    const res = await api<{
      setup_completed: boolean
      needs_setup: boolean
      stack: StackStatus | null
    }>("/api/v1/setup/stack")
    const st = res.stack
    setStackStatus(st)
    if (res.setup_completed || st?.status === "success" || st?.status === "skipped") {
      changeLocale(form.default_locale)
      window.location.assign("/login")
      return true
    }
    if (st?.status === "failed") {
      setErr(st.error || t("install_failed"))
      return true
    }
    return false
  }, [changeLocale, form.default_locale, t])

  useEffect(() => {
    if (step !== 3) return
    let cancelled = false
    const tick = async () => {
      try {
        const done = await pollStack()
        if (cancelled || done) return
      } catch {
        /* keep polling */
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [step, pollStack])

  async function submit(skipSoftware: boolean) {
    const validationError = validateStep(skipSoftware ? 1 : 2)
    if (validationError) {
      setErr(validationError)
      return
    }
    if (skipSoftware && !confirmSkip) {
      setConfirmSkip(true)
      setErr(t("skip_confirm_hint"))
      return
    }
    setErr(null)
    setPending(true)
    try {
      const stackPayload = skipSoftware
        ? { skip: true }
        : {
            skip: false,
            webserver: stack.webserver,
            database: stack.database,
            php_versions: stack.php_versions,
            redis: stack.redis,
            memcached: stack.memcached,
            pureftpd: stack.pureftpd,
          }

      const res = await api<{
        setup_completed: boolean
        stack: StackStatus | null
        message?: string
      }>("/api/v1/setup", {
        method: "POST",
        json: {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim() || null,
          password: form.password,
          password_confirmation: form.password_confirmation,
          default_locale: form.default_locale,
          panel_name: form.panel_name.trim(),
          hostname: form.hostname.trim() || null,
          stack: stackPayload,
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

      setStackStatus(res.stack)
      if (res.setup_completed) {
        changeLocale(form.default_locale)
        window.location.assign("/login")
        return
      }
      setStep(3)
    } catch (e) {
      setErr(e instanceof Error ? e.message : tCommon("error_generic"))
    } finally {
      setPending(false)
    }
  }

  async function retryStack() {
    setErr(null)
    setPending(true)
    try {
      await api("/api/v1/setup/stack/retry", { method: "POST" })
      setStep(3)
    } catch (e) {
      setErr(e instanceof Error ? e.message : tCommon("error_generic"))
    } finally {
      setPending(false)
    }
  }

  const steps = [
    t("step_admin_label"),
    t("step_settings_label"),
    t("step_software_label"),
    t("step_install_label"),
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
                  <p className="text-muted-foreground text-xs">{t("username_hint")}</p>
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
                  <Label htmlFor="password_confirmation">{t("password_confirm")}</Label>
                  <Input
                    id="password_confirmation"
                    type="password"
                    value={form.password_confirmation}
                    onChange={(e) => updateField("password_confirmation", e.target.value)}
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
                    {(["fa", "en"] as const).map((loc) => (
                      <Button
                        key={loc}
                        type="button"
                        variant={form.default_locale === loc ? "default" : "outline"}
                        onClick={() => {
                          updateField("default_locale", loc)
                          changeLocale(loc)
                        }}
                      >
                        {t(`locale_${loc}`)}
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
                <div className="grid gap-2">
                  <Label htmlFor="hostname">{t("hostname")}</Label>
                  <Input
                    id="hostname"
                    value={form.hostname}
                    onChange={(e) => updateField("hostname", e.target.value)}
                    placeholder={t("hostname_placeholder")}
                    dir="ltr"
                    className="font-mono"
                  />
                  <p className="text-muted-foreground text-xs">{t("hostname_hint")}</p>
                </div>
                <div className="rounded-md border p-4">
                  <p className="mb-3 text-sm font-medium">{t("smtp_optional_title")}</p>
                  <p className="text-muted-foreground mb-4 text-xs">{t("smtp_optional_hint")}</p>
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
                  <Button type="button" variant="outline" onClick={() => setStep(0)}>
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
                <p className="text-muted-foreground text-sm">{t("software_hint")}</p>

                <div className="grid gap-2">
                  <Label>{t("webserver")}</Label>
                  <div className="flex gap-2">
                    {(["nginx", "apache"] as const).map((ws) => (
                      <Button
                        key={ws}
                        type="button"
                        variant={stack.webserver === ws ? "default" : "outline"}
                        onClick={() => setStack((s) => ({ ...s, webserver: ws, skip: false }))}
                      >
                        {t(`webserver_${ws}`)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>{t("database")}</Label>
                  <div className="flex gap-2">
                    {(["mariadb", "mysql"] as const).map((db) => (
                      <Button
                        key={db}
                        type="button"
                        variant={stack.database === db ? "default" : "outline"}
                        onClick={() => setStack((s) => ({ ...s, database: db, skip: false }))}
                      >
                        {t(`database_${db}`)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>{t("php_versions")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {PHP_OPTIONS.map((ver) => (
                      <label key={ver} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={stack.php_versions.includes(ver)}
                          onChange={() => togglePhp(ver)}
                        />
                        PHP {ver}
                      </label>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">{t("php_always_tools")}</p>
                </div>

                <div className="grid gap-2">
                  <Label>{t("optional_packages")}</Label>
                  {(
                    [
                      ["redis", "redis"],
                      ["memcached", "memcached"],
                      ["pureftpd", "pureftpd"],
                    ] as const
                  ).map(([key, labelKey]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={stack[key]}
                        onChange={(e) =>
                          setStack((s) => ({ ...s, [key]: e.target.checked, skip: false }))
                        }
                      />
                      {t(`opt_${labelKey}`)}
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      {tCommon("back")}
                    </Button>
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => void submit(false)}
                    >
                      {t("install_software")}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    className="text-muted-foreground"
                    onClick={() => void submit(true)}
                  >
                    {confirmSkip ? t("skip_confirm") : t("skip_software")}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm font-medium">{t("installing_title")}</p>
                <p className="text-muted-foreground text-xs">{t("installing_hint")}</p>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${stackStatus?.percent ?? 0}%` }}
                  />
                </div>
                <p className="font-mono text-xs" dir="ltr">
                  {stackStatus?.percent ?? 0}%
                </p>
                <ul className="space-y-2 text-sm">
                  {(stackStatus?.steps ?? []).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 border-b pb-1">
                      <span>{s.label}</span>
                      <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                        {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
                {stackStatus?.status === "failed" ? (
                  <Button type="button" disabled={pending} onClick={() => void retryStack()}>
                    {t("retry_install")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
