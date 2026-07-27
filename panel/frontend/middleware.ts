import { NextResponse, type NextRequest } from "next/server"

const LOCALES = ["fa", "en"] as const
const PUBLIC_PATHS = ["/login", "/setup", "/forgot-password", "/reset-password"]

function getInternalApiBase(): string {
  return process.env.INTERNAL_API_URL ?? "http://backend:8080"
}

type GateStatus = {
  needs_setup: boolean
  authenticated: boolean
  unreachable?: boolean
}

async function fetchGate(request: NextRequest): Promise<GateStatus> {
  const base = getInternalApiBase()
  const headers = {
    Cookie: request.headers.get("cookie") ?? "",
    Accept: "application/json",
  }

  try {
    const res = await fetch(`${base}/v1/auth/gate`, {
      headers,
      cache: "no-store",
    })
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { needs_setup?: boolean; authenticated?: boolean }
      }
      return {
        needs_setup: body.data?.needs_setup ?? true,
        authenticated: body.data?.authenticated ?? false,
      }
    }
  } catch {
    // try setup/status fallback below
  }

  try {
    const res = await fetch(`${base}/v1/setup/status`, {
      headers,
      cache: "no-store",
    })
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { needs_setup?: boolean }
      }
      const needs_setup = body.data?.needs_setup ?? true
      let authenticated = false
      if (!needs_setup) {
        const check = await fetch(`${base}/v1/auth/check`, {
          headers,
          cache: "no-store",
        })
        if (check.ok) {
          const checkBody = (await check.json()) as { authenticated?: boolean }
          authenticated = checkBody.authenticated === true
        }
      }
      return { needs_setup, authenticated }
    }
  } catch {
    // API unreachable from panel frontend
  }

  return { needs_setup: true, authenticated: false, unreachable: true }
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname)
}

function withLocaleCookie(request: NextRequest, res: NextResponse): NextResponse {
  const cookie =
    request.cookies.get("NEXT_LOCALE")?.value ??
    request.cookies.get("locale")?.value
  const locale =
    cookie && LOCALES.includes(cookie as (typeof LOCALES)[number])
      ? cookie
      : "fa"
  if (!request.cookies.get("NEXT_LOCALE")) {
    res.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  res.headers.set("x-webina-locale", locale)
  return res
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const gate = await fetchGate(request)

  if (gate.unreachable) {
    if (isPublicPath(pathname)) {
      return withLocaleCookie(request, NextResponse.next())
    }
    const setupUrl = new URL("/setup", request.url)
    setupUrl.searchParams.set("error", "unavailable")
    return withLocaleCookie(request, NextResponse.redirect(setupUrl))
  }

  if (gate.needs_setup) {
    if (pathname === "/setup") {
      return withLocaleCookie(request, NextResponse.next())
    }
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL("/setup", request.url)),
    )
  }

  if (pathname === "/setup") {
    return withLocaleCookie(
      request,
      NextResponse.redirect(
        new URL(gate.authenticated ? "/" : "/login", request.url),
      ),
    )
  }

  if (isPublicPath(pathname)) {
    if (gate.authenticated) {
      return withLocaleCookie(
        request,
        NextResponse.redirect(new URL("/", request.url)),
      )
    }
    return withLocaleCookie(request, NextResponse.next())
  }

  if (!gate.authenticated) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return withLocaleCookie(request, NextResponse.redirect(loginUrl))
  }

  return withLocaleCookie(request, NextResponse.next())
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand|fonts|favicon.ico|placeholder.svg|api|embed).*)",
  ],
}
