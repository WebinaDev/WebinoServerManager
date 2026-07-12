const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

export type ApiOptions = RequestInit & {
  json?: unknown
}

export class ApiError extends Error {
  status: number
  data: Record<string, unknown> | null

  constructor(message: string, status: number, data: Record<string, unknown> | null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

function parseJsonBody(text: string): Record<string, unknown> | null {
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new ApiError(text.slice(0, 200) || "Invalid response", 0, null)
  }
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(opts.json !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers ?? {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    credentials: "include",
    body:
      opts.json !== undefined
        ? JSON.stringify(opts.json)
        : (opts.body as BodyInit | undefined),
  })

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  const data = parseJsonBody(text)

  if (!res.ok) {
    const msg =
      typeof data?.message === "string" ? data.message : `HTTP ${res.status}`
    const err = new ApiError(msg, res.status, data)
    if (
      typeof window !== "undefined" &&
      res.status === 401 &&
      !path.includes("/auth/login") &&
      !path.includes("/auth/check")
    ) {
      window.location.assign("/login")
    }
    if (
      typeof window !== "undefined" &&
      res.status === 403 &&
      data?.code === "two_factor_setup_required" &&
      !path.includes("/security/2fa")
    ) {
      window.location.assign("/security/2fa")
    }
    throw err
  }

  return data as T
}
