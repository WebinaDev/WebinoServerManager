"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, type ReactNode } from "react"

import { ApiError, api } from "@/lib/api"
import { permissionForPath } from "@/lib/routePermissions"
import { writePermissionForPath } from "@/lib/routeWritePermissions"

type PermissionUser = {
  permissions?: { name: string }[]
}

export function usePermissions() {
  const router = useRouter()
  const { data: user, isPending, isError, error } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => api<PermissionUser>("/api/v1/auth/user"),
    retry: false,
  })

  useEffect(() => {
    if (!isError || !(error instanceof ApiError)) {
      return
    }
    if (error.status === 401) {
      router.replace("/login")
      return
    }
    const code = error.data?.code
    if (error.status === 403 && code === "two_factor_setup_required") {
      router.replace("/security/2fa")
    }
  }, [error, isError, router])

  const names = new Set((user?.permissions ?? []).map((p) => p.name))

  const can = useCallback((perm: string) => names.has(perm), [names])

  return {
    permissions: names,
    can,
    isLoading: isPending,
    isError,
  }
}

export function RequireWrite({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const { can } = usePermissions()
  if (!can(permission)) {
    return null
  }
  return <>{children}</>
}

export function RequireRouteWrite({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const perm = writePermissionForPath(pathname)
  if (!perm) {
    return <>{children}</>
  }
  return <RequireWrite permission={perm}>{children}</RequireWrite>
}

export function RequirePermission({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { can, isLoading, isError } = usePermissions()
  const required = permissionForPath(pathname)

  useEffect(() => {
    if (isLoading || isError || required === undefined || pathname === "/forbidden") {
      return
    }
    if (required !== null && !can(required)) {
      router.replace("/forbidden")
    }
  }, [can, isError, isLoading, pathname, required, router])

  if (isLoading || isError) {
    return null
  }
  if (
    pathname !== "/forbidden" &&
    required !== undefined &&
    required !== null &&
    !can(required)
  ) {
    return null
  }

  return <>{children}</>
}
