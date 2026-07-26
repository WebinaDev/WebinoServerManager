"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type Website = {
  id: number
  fqdn: string
  aliases: string[] | null
  type: string
  engine: string
  document_root: string
  php_pool: string | null
  php_version: string | null
  ssl_enabled: boolean
  force_https: boolean
  hsts: boolean
  http3: boolean
  hotlink_protect: boolean
  rewrite_template: string
  rewrite_custom: string | null
  deny_paths: string[] | null
  traffic_limit_mb: number | null
  proxy_pass: string | null
  vhost_id: number | null
  status: string
  last_error: string | null
  ftp_account?: { id: number; username: string } | null
  ftpAccount?: { id: number; username: string } | null
  database?: { id: number; name: string; engine: string } | null
}

type Template = { id: string; label: string }

export default function WebsiteDetailPage() {
  const params = useParams()
  const id = String(params?.id ?? "")
  const t = useTranslations("websites")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [tab, setTab] = useState<
    "overview" | "protection" | "logs" | "analytics" | "composer"
  >("overview")
  const [htUser, setHtUser] = useState("")
  const [htPass, setHtPass] = useState("")
  const [htPath, setHtPath] = useState("/")
  const [logType, setLogType] = useState<"access" | "error">("access")
  const [logContent, setLogContent] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["website", id],
    enabled: Boolean(id),
    queryFn: () => api<{ website: Website }>(`/api/v1/websites/${id}`),
  })
  const { data: templatesData } = useQuery({
    queryKey: ["website-rewrite-templates"],
    queryFn: () => api<{ templates: Template[] }>("/api/v1/websites/rewrite-templates"),
  })

  const website = data?.website
  const [draft, setDraft] = useState<Partial<Website> | null>(null)
  const form = draft ?? website

  const save = useMutation({
    mutationFn: () => {
      if (!form) {
        throw new Error("missing")
      }
      return api(`/api/v1/websites/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          aliases: form.aliases,
          document_root: form.document_root,
          php_pool: form.php_pool,
          php_version: form.php_version,
          ssl_enabled: form.ssl_enabled,
          force_https: form.force_https,
          hsts: form.hsts,
          hotlink_protect: form.hotlink_protect,
          rewrite_template: form.rewrite_template,
          rewrite_custom: form.rewrite_custom,
          deny_paths: form.deny_paths,
          traffic_limit_mb: form.traffic_limit_mb,
          proxy_pass: form.proxy_pass,
          type: form.type,
          engine: form.engine,
          http3: form.http3,
        }),
      })
    },
    onSuccess: () => {
      toast.success(t("save"))
      setDraft(null)
      void qc.invalidateQueries({ queryKey: ["website", id] })
    },
    onError: toastMutationError,
  })

  const htpasswd = useMutation({
    mutationFn: () =>
      api(`/api/v1/websites/${id}/htpasswd`, {
        method: "POST",
        body: JSON.stringify({
          user: htUser,
          password: htPass,
          path: htPath || "/",
        }),
      }),
    onSuccess: () => toast.success(t("set_htpasswd")),
    onError: toastMutationError,
  })

  const loadLogs = useMutation({
    mutationFn: () =>
      api<{ content: string }>(
        `/api/v1/websites/${id}/logs?type=${logType}&lines=200`,
      ),
    onSuccess: (res) => setLogContent(res.content || ""),
    onError: toastMutationError,
  })

  const composer = useMutation({
    mutationFn: (command: "install" | "update") =>
      api(`/api/v1/websites/${id}/composer`, {
        method: "POST",
        body: JSON.stringify({ command }),
      }),
    onSuccess: () => toast.success(t("run_composer")),
    onError: toastMutationError,
  })

  if (isLoading || !form) {
    return <p className="text-muted-foreground text-sm">{tCommon("loading")}</p>
  }

  const setField = <K extends keyof Website>(key: K, value: Website[K]) => {
    setDraft({ ...(draft ?? website!), [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{form.fqdn}</h1>
          <p className="text-muted-foreground text-sm">
            {form.status}
            {form.last_error ? ` — ${form.last_error}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {form.vhost_id ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/webserver/vhosts/${form.vhost_id}`}>
                {t("advanced_vhost")}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href="/websites">{t("title")}</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", t("overview")],
            ["protection", t("protection")],
            ["logs", t("logs")],
            ["analytics", t("analytics")],
            ["composer", t("composer")],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("overview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label={t("field_docroot")}>
              <Input
                value={form.document_root}
                onChange={(e) => setField("document_root", e.target.value)}
              />
            </Field>
            <Field label={t("field_aliases")}>
              <Input
                value={(form.aliases ?? []).join(", ")}
                onChange={(e) =>
                  setField(
                    "aliases",
                    e.target.value
                      .split(/[\s,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
            <Field label={t("field_php_pool")}>
              <Input
                value={form.php_pool ?? ""}
                onChange={(e) => setField("php_pool", e.target.value || null)}
              />
            </Field>
            <Field label={t("field_engine")}>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={form.engine ?? "nginx"}
                onChange={(e) => {
                  const engine = e.target.value
                  setDraft({
                    ...(draft ?? website!),
                    engine,
                    http3: engine === "nginx" ? Boolean(form.http3) : false,
                  })
                }}
              >
                <option value="nginx">nginx</option>
                <option value="apache">Apache</option>
              </select>
            </Field>
            {(form.engine ?? "nginx") === "nginx" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form.http3)}
                  onChange={(e) => setField("http3", e.target.checked)}
                />
                {t("http3")}
              </label>
            )}
            <Field label={t("rewrite")}>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={form.rewrite_template}
                onChange={(e) => setField("rewrite_template", e.target.value)}
              >
                {(templatesData?.templates ?? []).map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("deny_paths")}>
              <Input
                value={(form.deny_paths ?? []).join(" ")}
                onChange={(e) =>
                  setField(
                    "deny_paths",
                    e.target.value
                      .split(/[\s,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
            <Field label={t("traffic_limit")}>
              <Input
                type="number"
                value={form.traffic_limit_mb ?? ""}
                onChange={(e) =>
                  setField(
                    "traffic_limit_mb",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </Field>
            {(
              [
                ["ssl_enabled", "ssl_enabled"],
                ["force_https", "force_https"],
                ["hsts", "hsts"],
                ["hotlink_protect", "hotlink"],
              ] as const
            ).map(([key, labelKey]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => setField(key, e.target.checked)}
                />
                {t(labelKey)}
              </label>
            ))}
            {(() => {
              const ftp = form.ftp_account ?? form.ftpAccount
              const db = form.database
              if (!ftp && !db) return null
              return (
                <p className="text-muted-foreground text-sm">
                  {ftp ? `FTP: ${ftp.username}` : null}
                  {ftp && db ? " · " : null}
                  {db ? `DB: ${db.name} (${db.engine})` : null}
                </p>
              )
            })()}
            <RequireRouteWrite>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                {t("save")}
              </Button>
            </RequireRouteWrite>
          </CardContent>
        </Card>
      )}

      {tab === "protection" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("protection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label={t("htpasswd_user")}>
              <Input value={htUser} onChange={(e) => setHtUser(e.target.value)} />
            </Field>
            <Field label={t("htpasswd_password")}>
              <Input
                type="password"
                value={htPass}
                onChange={(e) => setHtPass(e.target.value)}
              />
            </Field>
            <Field label={t("htpasswd_path")}>
              <Input value={htPath} onChange={(e) => setHtPath(e.target.value)} />
            </Field>
            <RequireRouteWrite>
              <Button
                disabled={!htUser || !htPass || htpasswd.isPending}
                onClick={() => htpasswd.mutate()}
              >
                {t("set_htpasswd")}
              </Button>
            </RequireRouteWrite>
          </CardContent>
        </Card>
      )}

      {tab === "logs" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("logs")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={logType === "access" ? "default" : "outline"}
                onClick={() => setLogType("access")}
              >
                {t("log_access")}
              </Button>
              <Button
                size="sm"
                variant={logType === "error" ? "default" : "outline"}
                onClick={() => setLogType("error")}
              >
                {t("log_error")}
              </Button>
              <Button
                size="sm"
                onClick={() => loadLogs.mutate()}
                disabled={loadLogs.isPending}
              >
                {t("load_logs")}
              </Button>
            </div>
            <pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
              {logContent || "—"}
            </pre>
          </CardContent>
        </Card>
      )}

      {tab === "analytics" && <WebsiteAnalytics id={id} />}

      {tab === "composer" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("composer")}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <RequireRouteWrite>
              <Button
                disabled={composer.isPending}
                onClick={() => composer.mutate("install")}
              >
                {t("run_composer")}
              </Button>
              <Button
                variant="outline"
                disabled={composer.isPending}
                onClick={() => composer.mutate("update")}
              >
                {t("run_composer_update")}
              </Button>
            </RequireRouteWrite>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function WebsiteAnalytics({ id }: { id: string }) {
  const t = useTranslations("websites")
  const tCommon = useTranslations("common")
  const { data, isLoading } = useQuery({
    queryKey: ["website-analytics", id],
    enabled: Boolean(id),
    queryFn: () =>
      api<{
        requests?: number
        status_counts?: Record<string, number>
      }>(`/api/v1/websites/${id}/analytics`),
  })

  if (isLoading) {
    return <p className="p-4 text-sm">{tCommon("loading")}</p>
  }

  const statuses = data?.status_counts ?? {}

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("analytics")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          {t("analytics_requests")}: {data?.requests ?? 0}
        </p>
        <div>
          <p className="mb-2 font-medium">{t("analytics_status")}</p>
          <ul className="space-y-1 font-mono text-xs" dir="ltr">
            {Object.entries(statuses).map(([code, count]) => (
              <li key={code}>
                {code}: {count}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
