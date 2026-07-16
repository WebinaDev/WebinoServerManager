import { cookies } from "next/headers"

import { unwrapApiData } from "@webina/ui"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

async function serverFetch(path: string, init?: RequestInit): Promise<unknown | null> {
  if (!API_BASE) {
    return null
  }

  const jar = await cookies()
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  if (!res.ok) {
    return null
  }

  const text = await res.text()
  if (!text) {
    return null
  }

  return JSON.parse(text) as unknown
}

/** Unwrapped API `data` payload (authenticated panel home). */
export async function apiServer<T>(path: string): Promise<T | null> {
  try {
    const raw = await serverFetch(path)
    if (raw == null) {
      return null
    }
    return unwrapApiData<T>(raw)
  } catch {
    return null
  }
}
