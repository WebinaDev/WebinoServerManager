"use client"

import { useTranslations } from "next-intl"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

export default function VhostEditorPage() {
  const t = useTranslations("webserver")
  const tCommon = useTranslations("common")
  const params = useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const id = Number(params?.id)
  const [redirectFrom, setRedirectFrom] = useState("/old")
  const [redirectTo, setRedirectTo] = useState("https://example.com")
  const [proxyTarget, setProxyTarget] = useState("http://127.0.0.1:3000")

  const { data, isLoading } = useQuery({
    queryKey: ["vhost", id],
    queryFn: () =>
      api<{ vhost: { fqdn: string }; content: string }>(`/api/v1/webserver/vhosts/${id}`),
    enabled: Number.isFinite(id),
  })

  const [content, setContent] = useState("")

  useEffect(() => {
    if (data?.content) {
      setContent(data.content)
    }
  }, [data?.content])

  const save = useMutation({
    mutationFn: () =>
      api(`/api/v1/webserver/vhosts/${id}`, {
        method: "PUT",
        json: { content },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vhost", id] }),
  })

  const addRedirect = useMutation({
    mutationFn: () =>
      api(`/api/v1/webserver/vhosts/${id}/redirects`, {
        method: "POST",
        json: { from: redirectFrom, to: redirectTo, code: "301" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vhost", id] }),
  })

  const addProxy = useMutation({
    mutationFn: () =>
      api(`/api/v1/webserver/vhosts/${id}/proxy`, {
        method: "POST",
        json: { target: proxyTarget },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vhost", id] }),
  })

  if (isLoading) {
    return <p className="p-6">{tCommon("loading")}</p>
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/webserver/vhosts")}>
          {t("back")}
        </Button>
        <h1 className="font-mono text-lg" dir="ltr">
          {data?.vhost.fqdn}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("raw_editor")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="border-input bg-background min-h-80 w-full rounded-md border p-3 font-mono text-sm"
            dir="ltr"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate(undefined)}>
            {t("save_reload")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("redirects")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>{t("redirect_from")}</Label>
            <Input value={redirectFrom} onChange={(e) => setRedirectFrom(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>{t("redirect_to")}</Label>
            <Input value={redirectTo} onChange={(e) => setRedirectTo(e.target.value)} dir="ltr" />
          </div>
          <Button type="button" disabled={addRedirect.isPending} onClick={() => addRedirect.mutate(undefined)}>
            {t("add_redirect")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("reverse_proxy")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grow space-y-2">
            <Label>{t("proxy_target")}</Label>
            <Input value={proxyTarget} onChange={(e) => setProxyTarget(e.target.value)} dir="ltr" />
          </div>
          <Button type="button" disabled={addProxy.isPending} onClick={() => addProxy.mutate(undefined)}>
            {t("add_proxy")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
