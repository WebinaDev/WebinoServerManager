import { NextResponse, type NextRequest } from "next/server"

const LOCALES = ["fa", "en"] as const
const AUTH_PUBLIC = ["/login", "/forgot-password", "/reset-password"]
const SETUP_PATHS = ["/setup", "/setup/stack"]

function getInternalApiBase(): string {
  return process.env.INTERNAL_API_URL ?? "http://backend:8080"
}

type GateStatus = {
  needs_setup: boolean
  setup_completed: boolean
  admin_created: boolean
  needs_stack: boolean
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
    const res = await fetch(`${base}/api/v1/auth/gate`, {
      headers,
      cache: "no-store",
    })
    if (res.ok) {
      const body = (await res.json()) as {
        data?: {
          needs_setup?: boolean
          setup_completed?: boolean
          admin_created?: boolean
          needs_stack?: boolean
          authenticated?: boolean
        }
      }
      const d = body.data ?? {}
      return {
        needs_setup: d.needs_setup ?? true,
        setup_completed: d.setup_completed ?? false,
        admin_created: d.admin_created ?? false,
        needs_stack: d.needs_stack ?? false,
        authenticated: d.authenticated ?? false,
      }
    }
  } catch {
    // fallback below
  }

  try {
    const res = await fetch(`${base}/api/v1/setup/status`, {
      headers,
      cache: "no-store",
    })
    if (res.ok) {
      const body = (await res.json()) as {
        data?: {
          needs_setup?: boolean
          setup_completed?: boolean
          admin_created?: boolean
          needs_stack?: boolean
        }
      }
      const d = body.data ?? {}
      return {
        needs_setup: d.needs_setup ?? true,
        setup_completed: d.setup_completed ?? false,
        admin_created: d.admin_created ?? false,
        needs_stack: d.needs_stack ?? false,
        authenticated: false,
      }
    }
  } catch {
    // unreachable
  }

  return {
    needs_setup: true,
    setup_completed: false,
    admin_created: false,
    needs_stack: false,
    authenticated: false,
    unreachable: true,
  }
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
    if (AUTH_PUBLIC.includes(pathname) || SETUP_PATHS.includes(pathname)) {
      return withLocaleCookie(request, NextResponse.next())
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", "unavailable")
    return withLocaleCookie(request, NextResponse.redirect(loginUrl))
  }

  // aaPanel-style: admin exists, stack not done
  if (gate.admin_created && !gate.setup_completed) {
    if (!gate.authenticated) {
      if (AUTH_PUBLIC.includes(pathname)) {
        return withLocaleCookie(request, NextResponse.next())
      }
      return withLocaleCookie(
        request,
        NextResponse.redirect(new URL("/login", request.url)),
      )
    }
    // Authenticated → software wizard
    if (pathname === "/setup/stack" || pathname === "/setup") {
      if (pathname === "/setup") {
        return withLocaleCookie(
          request,
          NextResponse.redirect(new URL("/setup/stack", request.url)),
        )
      }
      return withLocaleCookie(request, NextResponse.next())
    }
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL("/setup/stack", request.url)),
    )
  }

  // No admin yet → full /setup wizard (fallback if bootstrap-admin failed)
  if (!gate.admin_created && gate.needs_setup) {
    if (pathname === "/setup") {
      return withLocaleCookie(request, NextResponse.next())
    }
    if (AUTH_PUBLIC.includes(pathname)) {
      return withLocaleCookie(request, NextResponse.next())
    }
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL("/setup", request.url)),
    )
  }

  // Setup complete
  if (SETUP_PATHS.includes(pathname)) {
    return withLocaleCookie(
      request,
      NextResponse.redirect(
        new URL(gate.authenticated ? "/" : "/login", request.url),
      ),
    )
  }

  if (AUTH_PUBLIC.includes(pathname)) {
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
