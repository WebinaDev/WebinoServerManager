/** Write permission for mutation UI on read-open routes. Sync with backend config/route_write_permissions.php */
export const routeWritePermissions: Record<string, string> = {
  "/websites": "domains.manage",
  "/domains": "domains.manage",
  "/subdomains": "domains.manage",
  "/databases": "databases.manage",
  "/dns": "system.manage",
  "/ssl": "system.manage",
  "/ftp": "system.manage",
  "/php-settings": "system.manage",
  "/email/domains": "system.manage",
  "/email/auth": "system.manage",
  "/email/accounts": "system.manage",
  "/email/forwarders": "system.manage",
  "/email/autoresponders": "system.manage",
  "/email/lists": "system.manage",
  "/email/antispam": "system.manage",
  "/backups": "system.manage",
  "/settings": "system.manage",
  "/metrics-alerts": "system.manage",
  "/git": "system.manage",
  "/wordpress": "system.manage",
  "/support": "system.manage",
  "/apps": "apps.manage",
  "/softstore": "system.manage",
  "/runtimes": "system.manage",
  "/sites": "platform.manage",
  "/products": "platform.manage",
}

export function writePermissionForPath(pathname: string | null): string | undefined {
  if (!pathname) {
    return undefined
  }
  const entries = Object.entries(routeWritePermissions).sort(
    (a, b) => b[0].length - a[0].length,
  )
  for (const [path, perm] of entries) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return perm
    }
  }
  return undefined
}
