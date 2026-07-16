"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequireRouteWrite } from "@/hooks/usePermissions"
import { api } from "@/lib/api"
import { toast, toastMutationError } from "@/lib/toast"

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "PTR"] as const

type DnsZone = {
  id: number
  domain: string
  status: string
  zone_kind?: string
  dnssec_enabled?: boolean
  template?: string | null
  records: DnsRecord[]
}

type DnsRecord = {
  id: number
  type: string
  name: string
  content: string
  ttl: number
  priority?: number | null
  status: string
}

type DnsTemplate = {
  name: string
  description: string | null
}

function ptrZoneFromIp(ip: string): string {
  const parts = ip.trim().split(".")
  if (parts.length !== 4) return ""
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`
}

export default function DnsPage() {
  const t = useTranslations("dns")
  const tCommon = useTranslations("common")
  const qc = useQueryClient()
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null)
  const [recordType, setRecordType] = useState<string>("A")
  const [editingRecord, setEditingRecord] = useState<DnsRecord | null>(null)
  const [ptrIp, setPtrIp] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["dns-zones"],
    queryFn: () => api<{ zones: DnsZone[] }>("/api/v1/dns/zones"),
  })

  const { data: templates } = useQuery({
    queryKey: ["dns-templates"],
    queryFn: () => api<{ templates: DnsTemplate[] }>("/api/v1/dns/templates"),
  })

  const createZone = useMutation({
    mutationFn: (domain: string) =>
      api("/api/v1/dns/zones", { method: "POST", json: { domain } }),
    onSuccess: () => {
      toast.success(t("add_zone"))
      qc.invalidateQueries({ queryKey: ["dns-zones"] })
    },
    onError: toastMutationError,
  })

  const createSlaveZone = useMutation({
    mutationFn: (body: { domain: string; master_ns: string }) =>
      api("/api/v1/dns/zones/slave", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("add_slave_zone"))
      qc.invalidateQueries({ queryKey: ["dns-zones"] })
    },
    onError: toastMutationError,
  })

  const deleteZone = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/dns/zones/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete"))
      qc.invalidateQueries({ queryKey: ["dns-zones"] })
    },
    onError: toastMutationError,
  })

  const createRecord = useMutation({
    mutationFn: (body: {
      zone_id: number
      type: string
      name: string
      content: string
      ttl: number
      priority?: number
    }) => api("/api/v1/dns/records", { method: "POST", json: body }),
    onSuccess: () => {
      toast.success(t("add_record"))
      qc.invalidateQueries({ queryKey: ["dns-zones"] })
    },
    onError: toastMutationError,
  })

  const updateRecord = useMutation({
    mutationFn: (body: {
      id: number
      type: string
      name: string
      content: string
      ttl: number
      priority?: number
    }) =>
      api(`/api/v1/dns/records/${body.id}`, {
        method: "PATCH",
        json: {
          type: body.type,
          name: body.name,
          content: body.content,
          ttl: body.ttl,
          priority: body.priority,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dns-zones"] })
      setEditingRecord(null)
    },
  })

  const deleteRecord = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/dns/records/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("delete"))
      qc.invalidateQueries({ queryKey: ["dns-zones"] })
    },
    onError: toastMutationError,
  })

  const toggleDnssec = useMutation({
    mutationFn: ({ id, enable }: { id: number; enable: boolean }) =>
      api(`/api/v1/dns/zones/${id}/dnssec`, {
        method: enable ? "POST" : "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns-zones"] }),
  })

  const applyTemplate = useMutation({
    mutationFn: ({ zoneId, template }: { zoneId: number; template: string }) =>
      api(`/api/v1/dns/zones/${zoneId}/template`, {
        method: "POST",
        json: { template },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns-zones"] }),
  })

  const importZone = useMutation({
    mutationFn: ({ zoneId, content }: { zoneId: number; content: string }) =>
      api(`/api/v1/dns/zones/${zoneId}/import`, {
        method: "POST",
        json: { content },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns-zones"] }),
  })

  const exportZone = async (zoneId: number, domain: string) => {
    const res = await api<{ content: string }>(`/api/v1/dns/zones/${zoneId}/export`)
    const blob = new Blob([res.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${domain}.bind`
    a.click()
    URL.revokeObjectURL(url)
  }

  const zones = data?.zones ?? []
  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? zones[0]
  const records = selectedZone?.records ?? []
  const needsPriority = recordType === "MX" || recordType === "SRV"
  const ptrZone = ptrZoneFromIp(ptrIp)

  const recordColumns: DataTableColumn<DnsRecord>[] = [
    {
      id: "type",
      header: t("field_type"),
      sortValue: (row) => row.type,
      cell: (r) => (
        <span dir="ltr" className="font-mono">
          {r.type}
        </span>
      ),
    },
    {
      id: "name",
      header: t("field_name"),
      sortValue: (row) => row.name,
      cell: (r) => (
        <span dir="ltr" className="font-mono">
          {r.name}
        </span>
      ),
    },
    {
      id: "content",
      header: t("field_content"),
      sortValue: (row) => row.content,
      cell: (r) => (
        <span dir="ltr" className="font-mono">
          {r.content}
          {r.priority != null ? ` (pri ${r.priority})` : ""}
        </span>
      ),
    },
    {
      id: "ttl",
      header: t("field_ttl"),
      sortValue: (row) => row.ttl,
      cell: (r) => (
        <span dir="ltr" className="text-muted-foreground">
          {r.ttl}
        </span>
      ),
    },
    {
      id: "status",
      header: t("status"),
      sortValue: (row) => row.status,
      cell: (r) => <span className="text-muted-foreground">{r.status}</span>,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: (r) => (
        <div className="flex gap-2">
          <RequireRouteWrite>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingRecord(r)}
            >
              {t("edit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => deleteRecord.mutate(r.id)}
            >
              {t("delete")}
            </Button>
          </RequireRouteWrite>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RequireRouteWrite>
            <form
              className="flex flex-col gap-3 md:flex-row md:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createZone.mutate(String(fd.get("domain") ?? ""))
                e.currentTarget.reset()
              }}
            >
              <div className="grow space-y-2">
                <Label htmlFor="domain">{t("field_domain")}</Label>
                <Input id="domain" name="domain" required dir="ltr" />
              </div>
              <Button type="submit" disabled={createZone.isPending}>
                {t("add_zone")}
              </Button>
            </form>

            <form
              className="flex flex-col gap-3 md:flex-row md:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createSlaveZone.mutate({
                  domain: String(fd.get("slave_domain") ?? ""),
                  master_ns: String(fd.get("master_ns") ?? ""),
                })
                e.currentTarget.reset()
              }}
            >
              <div className="grow space-y-2">
                <Label htmlFor="slave_domain">{t("slave_domain")}</Label>
                <Input id="slave_domain" name="slave_domain" required dir="ltr" />
              </div>
              <div className="grow space-y-2">
                <Label htmlFor="master_ns">{t("master_ns")}</Label>
                <Input id="master_ns" name="master_ns" required dir="ltr" />
              </div>
              <Button type="submit" variant="outline" disabled={createSlaveZone.isPending}>
                {t("add_slave_zone")}
              </Button>
            </form>
          </RequireRouteWrite>

          {isLoading ? (
            <p>{tCommon("loading")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {zones.map((z) => (
                <li
                  key={z.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <button
                    type="button"
                    className="text-start font-medium hover:underline"
                    onClick={() => setSelectedZoneId(z.id)}
                  >
                    {z.domain}
                    {z.zone_kind === "slave" ? (
                      <span className="text-muted-foreground ms-2">({t("slave")})</span>
                    ) : null}
                  </button>
                  <span className="text-muted-foreground">
                    {z.dnssec_enabled ? t("dnssec_on") : z.status}
                  </span>
                  <RequireRouteWrite>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteZone.mutate(z.id)}
                    >
                      {t("delete")}
                    </Button>
                  </RequireRouteWrite>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedZone ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("zone_tools")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <RequireRouteWrite>
                <Button
                  type="button"
                  variant="outline"
                  disabled={toggleDnssec.isPending}
                  onClick={() =>
                    toggleDnssec.mutate({
                      id: selectedZone.id,
                      enable: !selectedZone.dnssec_enabled,
                    })
                  }
                >
                  {selectedZone.dnssec_enabled ? t("dnssec_disable") : t("dnssec_enable")}
                </Button>
                <select
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      applyTemplate.mutate({ zoneId: selectedZone.id, template: e.target.value })
                      e.target.value = ""
                    }
                  }}
                >
                  <option value="">{t("apply_template")}</option>
                  {(templates?.templates ?? []).map((tpl) => (
                    <option key={tpl.name} value={tpl.name}>
                      {tpl.description ?? tpl.name}
                    </option>
                  ))}
                </select>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <span>{t("import_zone")}</span>
                  <input
                    type="file"
                    accept=".bind,.zone,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      void file.text().then((content) =>
                        importZone.mutate({ zoneId: selectedZone.id, content }),
                      )
                      e.target.value = ""
                    }}
                  />
                </label>
              </RequireRouteWrite>
              <Button
                type="button"
                variant="outline"
                onClick={() => exportZone(selectedZone.id, selectedZone.domain)}
              >
                {t("export_zone")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("ptr_helper")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="ptr_ip">{t("ptr_ip")}</Label>
                <Input
                  id="ptr_ip"
                  value={ptrIp}
                  onChange={(e) => setPtrIp(e.target.value)}
                  placeholder="192.0.2.1"
                  dir="ltr"
                />
              </div>
              {ptrZone ? (
                <p className="text-muted-foreground font-mono text-sm" dir="ltr">
                  {t("ptr_zone")}: {ptrZone}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t("records_for", { domain: selectedZone.domain })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RequireRouteWrite>
                <form
                  className="grid gap-3 md:grid-cols-6"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    const priority = fd.get("priority")
                    createRecord.mutate({
                      zone_id: selectedZone.id,
                      type: recordType,
                      name: String(fd.get("name") ?? ""),
                      content: String(fd.get("content") ?? ""),
                      ttl: Number(fd.get("ttl") ?? 3600),
                      priority: priority ? Number(priority) : undefined,
                    })
                    e.currentTarget.reset()
                  }}
                >
                <div className="space-y-2">
                  <Label htmlFor="type">{t("field_type")}</Label>
                  <select
                    id="type"
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value)}
                    className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  >
                    {RECORD_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t("field_name")}</Label>
                  <Input id="name" name="name" required dir="ltr" placeholder="@" />
                </div>
                {needsPriority ? (
                  <div className="space-y-2">
                    <Label htmlFor="priority">{t("field_priority")}</Label>
                    <Input id="priority" name="priority" type="number" defaultValue={10} dir="ltr" />
                  </div>
                ) : null}
                <div className={`space-y-2 ${needsPriority ? "" : "md:col-span-2"}`}>
                  <Label htmlFor="content">{t("field_content")}</Label>
                  <Input id="content" name="content" required dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttl">{t("field_ttl")}</Label>
                  <Input id="ttl" name="ttl" type="number" defaultValue={3600} dir="ltr" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={createRecord.isPending}>
                    {t("add_record")}
                  </Button>
                </div>
                </form>
              </RequireRouteWrite>

              <DataTable
                columns={recordColumns}
                data={records}
                rowKey={(row) => row.id}
                searchPlaceholder={t("search_records")}
                searchFilter={(row, q) =>
                  row.type.toLowerCase().includes(q) ||
                  row.name.toLowerCase().includes(q) ||
                  row.content.toLowerCase().includes(q)
                }
                emptyMessage={t("empty_records")}
              />
            </CardContent>
          </Card>
        </>
      ) : null}

      {editingRecord ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("edit_record")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RequireRouteWrite>
              <form
                className="grid gap-3 md:grid-cols-5"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const priority = fd.get("priority")
                  updateRecord.mutate({
                    id: editingRecord.id,
                    type: String(fd.get("type") ?? editingRecord.type),
                    name: String(fd.get("name") ?? ""),
                    content: String(fd.get("content") ?? ""),
                    ttl: Number(fd.get("ttl") ?? 3600),
                    priority: priority ? Number(priority) : undefined,
                  })
                }}
              >
              <div className="space-y-2">
                <Label>{t("field_type")}</Label>
                <Input name="type" defaultValue={editingRecord.type} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t("field_name")}</Label>
                <Input name="name" defaultValue={editingRecord.name} required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t("field_content")}</Label>
                <Input name="content" defaultValue={editingRecord.content} required dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t("field_ttl")}</Label>
                <Input name="ttl" type="number" defaultValue={editingRecord.ttl} dir="ltr" />
              </div>
              {(editingRecord.type === "MX" || editingRecord.type === "SRV") && (
                <div className="space-y-2">
                  <Label>{t("field_priority")}</Label>
                  <Input
                    name="priority"
                    type="number"
                    defaultValue={editingRecord.priority ?? 10}
                    dir="ltr"
                  />
                </div>
              )}
              <div className="flex gap-2 md:col-span-5">
                <Button type="submit" disabled={updateRecord.isPending}>
                  {t("save")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingRecord(null)}>
                  {tCommon("cancel")}
                </Button>
              </div>
              </form>
            </RequireRouteWrite>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
