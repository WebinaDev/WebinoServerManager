"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { SkipLink } from "@/components/SkipLink"
import { useLocaleSync } from "@/hooks/useLocaleSync"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

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

const PHP_OPTIONS = ["8.1", "8.2", "8.3", "8.4"] as const

const initialStack: StackForm = {
  webserver: "nginx",
  database: "mariadb",
  php_versions: ["8.2", "8.3"],
  redis: false,
  memcached: false,
  pureftpd: false,
  skip: false,
}

export default function SetupStackWizardPage() {
  const t = useTranslations("setup")
  const tCommon = useTranslations("common")
  useLocaleSync()
  const [phase, setPhase] = useState<"choose" | "install">("choose")
  const [stack, setStack] = useState<StackForm>(initialStack)
  const [stackStatus, setStackStatus] = useState<StackStatus | null>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const termRef = useRef<HTMLPreElement>(null)

  const terminalText = useMemo(() => {
    const lines: string[] = []
    if (stackStatus?.error) {
      lines.push(`# error: ${stackStatus.error}`)
    }
    for (const s of stackStatus?.steps ?? []) {
      lines.push(`── ${s.label} [${s.status}]`)
      if (s.log) {
        lines.push(s.log.trimEnd())
      }
      lines.push("")
    }
    return lines.join("\n") || t("terminal_waiting")
  }, [stackStatus, t])

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight })
  }, [terminalText])

  const pollStack = useCallback(async () => {
    const res = await api<{
      setup_completed: boolean
      needs_setup: boolean
      stack: StackStatus | null
    }>("/api/v1/setup/stack")
    const st = res.stack
    setStackStatus(st)
    if (res.setup_completed || st?.status === "success" || st?.status === "skipped") {
      window.location.assign("/")
      return true
    }
    if (st?.status === "failed") {
      setErr(st.error || t("install_failed"))
      return true
    }
    return false
  }, [t])

  useEffect(() => {
    if (phase !== "install") {
      return
    }
    let cancelled = false
    const tick = async () => {
      try {
        const done = await pollStack()
        if (!cancelled && !done) {
          window.setTimeout(() => void tick(), 2000)
        }
      } catch {
        if (!cancelled) {
          window.setTimeout(() => void tick(), 3000)
        }
      }
    }
    void tick()
    return () => {
      cancelled = true
    }
  }, [phase, pollStack])

  function togglePhp(ver: string) {
    setStack((s) => {
      const has = s.php_versions.includes(ver)
      const next = has
        ? s.php_versions.filter((v) => v !== ver)
        : [...s.php_versions, ver]
      return { ...s, php_versions: next, skip: false }
    })
  }

  async function submit(skip: boolean) {
    if (skip && !confirmSkip) {
      setConfirmSkip(true)
      return
    }
    setErr(null)
    setPending(true)
    try {
      if (!skip && stack.php_versions.length === 0) {
        setErr(t("errors_php_required"))
        setPending(false)
        return
      }
      const stackPayload = skip
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
      }>("/api/v1/setup/stack", {
        method: "POST",
        json: { stack: stackPayload },
      })
      setStackStatus(res.stack)
      if (res.setup_completed) {
        window.location.assign("/")
        return
      }
      setPhase("install")
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
      setPhase("install")
    } catch (e) {
      setErr(e instanceof Error ? e.message : tCommon("error_generic"))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <SkipLink href="#setup-stack-main" labelKey="a11y_skip_to_setup" />
      <main
        id="setup-stack-main"
        tabIndex={-1}
        className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 p-6 outline-none"
      >
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{t("stack_title")}</CardTitle>
                <CardDescription>{t("stack_subtitle")}</CardDescription>
              </div>
              <LocaleSwitcher />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {err ? (
              <p className="text-destructive text-sm" role="alert">
                {err}
              </p>
            ) : null}

            {phase === "choose" ? (
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
                  <Button type="button" disabled={pending} onClick={() => void submit(false)}>
                    {t("install_software")}
                  </Button>
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

            {phase === "install" ? (
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
                    <li
                      key={s.id}
                      className={cn(
                        "flex items-center justify-between gap-2 border-b pb-1",
                        s.status === "failed" && "text-destructive",
                        s.status === "success" && "text-primary",
                      )}
                    >
                      <span>{s.label}</span>
                      <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                        {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="overflow-hidden rounded-md border bg-zinc-950">
                  <div className="border-b border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
                    {t("terminal_title")}
                  </div>
                  <pre
                    ref={termRef}
                    dir="ltr"
                    className="max-h-72 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-zinc-100"
                  >
                    {terminalText}
                  </pre>
                </div>
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
