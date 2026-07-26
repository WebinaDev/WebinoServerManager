"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

type WebsiteRow = {
  id: number
  fqdn: string
  type: string
  php_pool: string | null
  ssl_enabled: boolean
  status: string
  hosting_account_id: number | null
}

type AccountRow = { id: number; username: string; primary_domain: string | null }
type PhpPool = { name: string }
type Template = { id: string; label: string }

type CreateState = {
  fqdn: string
  aliases: string
  type: string
  document_root: string
  php_pool: string
  php_version: string
    engine: string
    http3: boolean
    create_php_pool: boolean
    ssl_enabled: boolean
    force_https: boolean
    hsts: boolean
    hotlink_protect: boolean
    issue_ssl: boolean
  rewrite_template: string
  rewrite_custom: string
  deny_paths: string
  traffic_limit_mb: string
  proxy_pass: string
  hosting_account_id: string
  create_ftp: boolean
  ftp_username: string
  ftp_password: string
  create_database: boolean
  database_name: string
}

const emptyCreate = (): CreateState => ({
  fqdn: "",
  aliases: "",
  type: "php",
  engine: "nginx",
  http3: false,
  document_root: "",
  php_pool: "",
  php_version: "8.3",
  create_php_pool: false,
  ssl_enabled: false,
  force_https: false,
  hsts: false,
  hotlink_protect: false,
  issue_ssl: false,
  rewrite_template: "none",
  rewrite_custom: "",
  deny_paths: "",
  traffic_limit_mb: "",
  proxy_pass: "",
  hosting_account_id: "",
  create_ftp: false,
  ftp_username: "",
  ftp_password: "",
  create_database: false,
  database_name: "",
})

export default function WebsitesPage() {
  const t = useTranslations("websites")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const accountFilter = Number(searchParams.get("account") ?? "") || null
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateState>(emptyCreate)

  const { data, isLoading } = useQuery({
    queryKey: ["websites"],
    queryFn: () => api<{ websites: WebsiteRow[] }>("/api/v1/websites"),
  })
  const { data: accountsData } = useQuery({
    queryKey: ["hosting-accounts"],
    queryFn: () => api<{ accounts: AccountRow[] }>("/api/v1/hosting/accounts"),
  })
  const { data: phpPools } = useQuery({
    queryKey: ["php-pools"],
    queryFn: () => api<{ pools: PhpPool[] }>("/api/v1/php/pools"),
  })
  const { data: templatesData } = useQuery({
    queryKey: ["website-rewrite-templates"],
    queryFn: () => api<{ templates: Template[] }>("/api/v1/websites/rewrite-templates"),
  })

  const websites = (data?.websites ?? []).filter(
    (w) => accountFilter == null || w.hosting_account_id === accountFilter,
  )
  const accounts = accountsData?.accounts ?? []

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        fqdn: form.fqdn.trim(),
        aliases: form.aliases,
        type: form.type,
        engine: form.engine,
        http3: form.http3,
        document_root: form.document_root || undefined,
        php_pool: form.php_pool || undefined,
        php_version: form.php_version || undefined,
        create_php_pool: form.create_php_pool,
        ssl_enabled: form.ssl_enabled,
        force_https: form.force_https,
        hsts: form.hsts,
        hotlink_protect: form.hotlink_protect,
        issue_ssl: form.issue_ssl,
        rewrite_template: form.rewrite_template,
        rewrite_custom: form.rewrite_custom || undefined,
        deny_paths: form.deny_paths,
        traffic_limit_mb: form.traffic_limit_mb ? Number(form.traffic_limit_mb) : undefined,
        proxy_pass: form.proxy_pass || undefined,
        hosting_account_id: form.hosting_account_id
          ? Number(form.hosting_account_id)
          : undefined,
        create_ftp: form.create_ftp,
        ftp_username: form.ftp_username || undefined,
        ftp_password: form.ftp_password || undefined,
        create_database: form.create_database,
        database_name: form.database_name || undefined,
      }
      return api<{ website: WebsiteRow; credentials?: unknown }>("/api/v1/websites", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    onSuccess: (res) => {
      toast.success(t("add"))
      if (res.credentials) {
        toast.success(t("credentials"))
      }
      setOpen(false)
      setForm(emptyCreate())
      void qc.invalidateQueries({ queryKey: ["websites"] })
    },
    onError: toastMutationError,
  })

  const destroy = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/websites/${id}`, { method: "DELETE", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success(t("delete"))
      void qc.invalidateQueries({ queryKey: ["websites"] })
    },
    onError: toastMutationError,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <RequireRouteWrite>
          <Button onClick={() => setOpen(true)}>{t("add")}</Button>
        </RequireRouteWrite>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{tCommon("loading")}</p>
          ) : websites.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pe-3">FQDN</th>
                    <th className="py-2 pe-3">{t("field_type")}</th>
                    <th className="py-2 pe-3">PHP</th>
                    <th className="py-2 pe-3">SSL</th>
                    <th className="py-2 pe-3">{t("status")}</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {websites.map((w) => (
                    <tr key={w.id} className="border-b last:border-0">
                      <td className="py-2 pe-3 font-medium">{w.fqdn}</td>
                      <td className="py-2 pe-3">{w.type}</td>
                      <td className="py-2 pe-3">{w.php_pool ?? "—"}</td>
                      <td className="py-2 pe-3">{w.ssl_enabled ? "yes" : "no"}</td>
                      <td className="py-2 pe-3">{w.status}</td>
                      <td className="py-2 text-end space-x-2 rtl:space-x-reverse">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/websites/${w.id}`}>{t("open")}</Link>
                        </Button>
                        <RequireRouteWrite>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm(t("delete_confirm"))) {
                                destroy.mutate(w.id)
                              }
                            }}
                          >
                            {t("delete")}
                          </Button>
                        </RequireRouteWrite>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t("field_fqdn")}>
              <Input
                value={form.fqdn}
                onChange={(e) => setForm({ ...form, fqdn: e.target.value })}
              />
            </Field>
            <Field label={t("field_aliases")}>
              <Input
                value={form.aliases}
                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
                placeholder="www.example.com"
              />
            </Field>
            <Field label={t("field_type")}>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="php">{t("type_php")}</option>
                <option value="static">{t("type_static")}</option>
                <option value="proxy">{t("type_proxy")}</option>
              </select>
            </Field>
            <Field label={t("field_engine")}>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={form.engine}
                onChange={(e) =>
                  setForm({
                    ...form,
                    engine: e.target.value,
                    http3: e.target.value === "nginx" ? form.http3 : false,
                  })
                }
              >
                <option value="nginx">nginx</option>
                <option value="apache">Apache</option>
              </select>
            </Field>
            {form.engine === "nginx" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.http3}
                  onChange={(e) => setForm({ ...form, http3: e.target.checked })}
                />
                {t("http3")}
              </label>
            )}
            <Field label={t("field_docroot")}>
              <Input
                value={form.document_root}
                onChange={(e) => setForm({ ...form, document_root: e.target.value })}
              />
            </Field>
            {form.type === "php" && (
              <>
                <Field label={t("field_php_pool")}>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={form.php_pool}
                    onChange={(e) => setForm({ ...form, php_pool: e.target.value })}
                  >
                    <option value="">—</option>
                    {(phpPools?.pools ?? []).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.create_php_pool}
                    onChange={(e) =>
                      setForm({ ...form, create_php_pool: e.target.checked })
                    }
                  />
                  {t("create_php_pool")}
                </label>
                <Field label={t("field_php_version")}>
                  <Input
                    value={form.php_version}
                    onChange={(e) => setForm({ ...form, php_version: e.target.value })}
                  />
                </Field>
              </>
            )}
            {form.type === "proxy" && (
              <Field label={t("proxy_pass")}>
                <Input
                  value={form.proxy_pass}
                  onChange={(e) => setForm({ ...form, proxy_pass: e.target.value })}
                />
              </Field>
            )}
            <Field label={t("rewrite")}>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={form.rewrite_template}
                onChange={(e) => setForm({ ...form, rewrite_template: e.target.value })}
              >
                {(templatesData?.templates ?? []).map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </Field>
            {form.rewrite_template === "custom" && (
              <Field label={t("rewrite_custom")}>
                <Input
                  value={form.rewrite_custom}
                  onChange={(e) => setForm({ ...form, rewrite_custom: e.target.value })}
                />
              </Field>
            )}
            <Field label={t("deny_paths")}>
              <Input
                value={form.deny_paths}
                onChange={(e) => setForm({ ...form, deny_paths: e.target.value })}
                placeholder="/.env /.git"
              />
            </Field>
            <Field label={t("traffic_limit")}>
              <Input
                type="number"
                value={form.traffic_limit_mb}
                onChange={(e) => setForm({ ...form, traffic_limit_mb: e.target.value })}
              />
            </Field>
            <Field label={t("hosting_account")}>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={form.hosting_account_id}
                onChange={(e) =>
                  setForm({ ...form, hosting_account_id: e.target.value })
                }
              >
                <option value="">{t("no_account")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.username}
                    {a.primary_domain ? ` (${a.primary_domain})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {(
              [
                ["ssl_enabled", "ssl_enabled"],
                ["force_https", "force_https"],
                ["hsts", "hsts"],
                ["hotlink_protect", "hotlink"],
                ["issue_ssl", "issue_ssl"],
                ["create_ftp", "create_ftp"],
                ["create_database", "create_db"],
              ] as const
            ).map(([key, labelKey]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {t(labelKey)}
              </label>
            ))}
            {form.create_ftp && (
              <>
                <Field label={t("ftp_username")}>
                  <Input
                    value={form.ftp_username}
                    onChange={(e) => setForm({ ...form, ftp_username: e.target.value })}
                  />
                </Field>
                <Field label={t("ftp_password")}>
                  <Input
                    type="password"
                    value={form.ftp_password}
                    onChange={(e) => setForm({ ...form, ftp_password: e.target.value })}
                  />
                </Field>
              </>
            )}
            {form.create_database && (
              <Field label={t("database_name")}>
                <Input
                  value={form.database_name}
                  onChange={(e) => setForm({ ...form, database_name: e.target.value })}
                />
              </Field>
            )}
            <Button
              className="w-full"
              disabled={!form.fqdn.trim() || create.isPending}
              onClick={() => create.mutate(undefined)}
            >
              {t("add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
