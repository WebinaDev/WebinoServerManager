"use client"

import type { ReactNode } from "react"

/**
 * Setup/auth navigation is enforced by Next.js middleware (server-side gate).
 * Client redirects here previously raced with middleware and caused refresh loops.
 */
export function EnsureSetupComplete({ children }: { children: ReactNode }) {
  return children
}
