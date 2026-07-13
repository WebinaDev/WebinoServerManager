import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/setup", "/forgot-password", "/reset-password"]
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? "webino_auth_token"

function getInternalApiBase(): string {
  return process.env.INTERNAL_API_URL ?? "http://localhost:8080"
}

type GateStatus = {
  needs_setup: boolean
  authenticated: boolean
  unreachable?: boolean
}

async function fetchGate(request: NextRequest): Promise<GateStatus> {
  try {
    const res = await fetch(`${getInternalApiBase()}/v1/auth/gate`, {
      headers: {
        Cookie: request.headers.get("cookie") ?? "",
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) {
      return { needs_setup: true, authenticated: false, unreachable: true }
    }
    const body = (await res.json()) as {
      data?: { needs_setup?: boolean; authenticated?: boolean }
    }
    return {
      needs_setup: body.data?.needs_setup ?? true,
      authenticated: body.data?.authenticated ?? false,
    }
  } catch {
    return { needs_setup: true, authenticated: false, unreachable: true }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const gate = await fetchGate(request)

  if (gate.unreachable) {
    if (pathname === "/setup") {
      return NextResponse.next()
    }
    const setupUrl = new URL("/setup", request.url)
    setupUrl.searchParams.set("error", "unavailable")
    return NextResponse.redirect(setupUrl)
  }

  if (gate.needs_setup) {
    if (pathname === "/setup") {
      return NextResponse.next()
    }
    if (pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password") {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL("/setup", request.url))
  }

  if (pathname === "/setup") {
    return NextResponse.redirect(new URL(gate.authenticated ? "/" : "/login", request.url))
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    if (gate.authenticated) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  if (!gate.authenticated) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand|placeholder.svg|fonts|api).*)",
  ],
}
