"use client"

import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

type FirewallRule = {
  num: string
  rule: string
}

type FirewallData = {
  enabled?: boolean
  rules?: FirewallRule[]
  raw?: string
}

type FirewallMutation = {
  action: string
  port?: string
  proto?: string
  rule_num?: number
  preset?: string
  from_ip?: string
}

export default function FirewallPage() {
  const t = useTranslations("security")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["firewall"],
    queryFn: () => api<FirewallData>("/api/v1/security/firewall"),
  })

  const { data: allowlistData } = useQuery({
    queryKey: ["firewall-allowlist"],
    queryFn: () => api<{ allowlist: string[] }>("/api/v1/security/firewall/allowlist"),
  })

  const mutate = useMutation({
    mutationFn: (body: FirewallMutation) =>
      api("/api/v1/security/firewall", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firewall"] }),
  })

  const saveAllowlist = useMutation({
    mutationFn: (allowlist: string[]) =>
      api("/api/v1/security/firewall/allowlist", { method: "POST", json: { allowlist } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firewall-allowlist"] }),
  })

  const rules = data?.rules ?? []
  const allowlist = (allowlistData?.allowlist ?? []).join(", ")

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("firewall_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("firewall_status")}:{" "}
                  {data?.enabled ? t("enabled") : t("disabled")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutate.isPending || data?.enabled}
                  onClick={() => mutate.mutate({ action: "enable" })}
                >
                  {t("firewall_enable")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutate.isPending || !data?.enabled}
                  onClick={() => mutate.mutate({ action: "disable" })}
                >
                  {t("firewall_disable")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate({ action: "preset", preset: "web" })}
                >
                  {t("firewall_preset_web")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate({ action: "preset", preset: "ssh" })}
                >
                  {t("firewall_preset_ssh")}
                </Button>
              </div>

              <form
                className="grid gap-3 md:grid-cols-5"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const fromIp = String(fd.get("from_ip") ?? "").trim()
                  mutate.mutate({
                    action: String(fd.get("action") ?? "allow"),
                    port: String(fd.get("port") ?? ""),
                    proto: String(fd.get("proto") ?? "tcp") || "tcp",
                    from_ip: fromIp || undefined,
                  })
                  e.currentTarget.reset()
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="fw-action">{t("firewall_action")}</Label>
                  <select
                    id="fw-action"
                    name="action"
                    className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                    defaultValue="allow"
                  >
                    <option value="allow">{t("firewall_allow")}</option>
                    <option value="deny">{t("firewall_deny")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fw-from-ip">{t("firewall_from_ip")}</Label>
                  <Input
                    id="fw-from-ip"
                    name="from_ip"
                    dir="ltr"
                    placeholder="203.0.113.0/24"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fw-port">{t("firewall_port")}</Label>
                  <Input id="fw-port" name="port" required dir="ltr" placeholder="80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fw-proto">{t("firewall_proto")}</Label>
                  <Input id="fw-proto" name="proto" defaultValue="tcp" dir="ltr" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={mutate.isPending}>
                    {t("firewall_apply")}
                  </Button>
                </div>
              </form>

              <ul className="divide-y rounded-md border">
                {rules.length === 0 ? (
                  <li className="text-muted-foreground px-4 py-3 text-sm">
                    {t("firewall_no_rules")}
                  </li>
                ) : (
                  rules.map((r) => (
                    <li
                      key={r.num}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <span dir="ltr">
                        [{r.num}] {r.rule}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={mutate.isPending}
                        onClick={() =>
                          mutate.mutate({
                            action: "delete",
                            rule_num: Number(r.num),
                          })
                        }
                      >
                        {t("delete")}
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("allowlist_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">{t("allowlist_hint")}</p>
          <form
            className="flex flex-col gap-3 md:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const raw = String(fd.get("allowlist") ?? "")
              const ips = raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
              saveAllowlist.mutate(ips)
            }}
          >
            <Input
              name="allowlist"
              defaultValue={allowlist}
              dir="ltr"
              placeholder="127.0.0.1, 10.0.0.0/8"
              className="flex-1"
            />
            <Button type="submit" disabled={saveAllowlist.isPending}>
              {t("allowlist_save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
