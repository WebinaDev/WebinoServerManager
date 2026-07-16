"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

type TicketResponse = {
  data: {
    ticket: string
    ws_path: string
  }
}

export default function TerminalPage() {
  const t = useTranslations("terminal")
  const tCommon = useTranslations("common")
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle")

  const sendResize = useCallback((term: Terminal, ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return
    ws.send(
      JSON.stringify({
        type: "resize",
        cols: term.cols,
        rows: term.rows,
      }),
    )
  }, [])

  const connect = useCallback(async () => {
    setStatus("connecting")
    try {
      const ticketRes = await api<TicketResponse>("/api/v1/terminal/ticket", {
        method: "POST",
      })
      const ticket = ticketRes.data.ticket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/api/terminal/ws?ticket=${encodeURIComponent(ticket)}`,
      )
      wsRef.current = ws

      ws.onopen = () => {
        setStatus("connected")
        const term = termRef.current
        if (term) sendResize(term, ws)
      }
      ws.onmessage = (ev) => {
        termRef.current?.write(typeof ev.data === "string" ? ev.data : "")
      }
      ws.onclose = () => setStatus("idle")
      ws.onerror = () => setStatus("error")

      if (termRef.current) {
        termRef.current.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data)
        })
      }
    } catch {
      setStatus("error")
    }
  }, [sendResize])

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "monospace",
      theme: { background: "#09090b" },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const onResize = () => {
      fit.fit()
      const ws = wsRef.current
      if (ws) sendResize(term, ws)
    }
    window.addEventListener("resize", onResize)

    void connect()

    return () => {
      window.removeEventListener("resize", onResize)
      wsRef.current?.close()
      term.dispose()
    }
  }, [connect, sendResize])

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{t("title")}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {status === "connecting" && t("connecting")}
              {status === "connected" && t("connected")}
              {status === "error" && t("error")}
              {status === "idle" && t("disconnected")}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void connect()}>
              {t("reconnect")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={containerRef}
            className="h-[min(70vh,32rem)] w-full overflow-hidden rounded-md border p-1"
            dir="ltr"
          />
        </CardContent>
      </Card>
    </div>
  )
}
