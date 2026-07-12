"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

export function DashboardPrefetch() {
  const queryClient = useQueryClient()

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["auth-user"],
      queryFn: () => api("/api/v1/auth/user"),
    })
    void queryClient.prefetchQuery({
      queryKey: ["auth-gate"],
      queryFn: () =>
        api<{ data: { needs_setup: boolean; authenticated: boolean } }>(
          "/api/v1/auth/gate",
        ).then((r) => r.data),
    })
  }, [queryClient])

  return null
}
