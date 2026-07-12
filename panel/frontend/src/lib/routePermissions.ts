/** Route path -> required Spatie permission (null = any authenticated user). Sync with backend config/route_permissions.php */
export const routePermissions: Record<string, string | null> = {
  "/hosting/plans": "hosting.manage",
  "/hosting/accounts": "hosting.manage",
  "/users": "users.manage",
  "/security/2fa": null,
  "/security/firewall": "security.manage",
  "/security/waf": "security.manage",
  "/security/fail2ban": "security.manage",
  "/security/sshkeys": "security.manage",
  "/security/clamav": "security.manage",
  "/security/audit": "security.manage",
  "/domains": null,
  "/subdomains": null,
  "/databases": null,
  "/webserver/vhosts": "system.manage",
  "/apps": null,
  "/monitoring/services": "monitoring.manage",
  "/monitoring/logs": "monitoring.manage",
  "/monitoring/uptime": "monitoring.manage",
  "/monitoring/channels": "monitoring.manage",
  "/api-tokens": "tokens.manage",
  "/webhooks": "webhooks.manage",
  "/profile": null,
  "/forbidden": null,
  "/dns": null,
  "/ssl": null,
  "/ftp": null,
  "/phpmyadmin": "embed.phpmyadmin",
  "/phppgadmin": "embed.phppgadmin",
  "/php-settings": null,
  "/email/domains": null,
  "/email/auth": null,
  "/email/accounts": null,
  "/email/forwarders": null,
  "/email/autoresponders": null,
  "/email/lists": null,
  "/email/queue": "system.manage",
  "/email/antispam": null,
  "/webmail": "embed.webmail",
  "/files": "system.manage",
  "/terminal": "system.manage",
  "/cron": "system.manage",
  "/backups": null,
  "/system-info": null,
  "/metrics-alerts": null,
  "/sites": null,
  "/products": null,
  "/git": null,
  "/wordpress": null,
  "/support": null,
}

export function permissionForPath(pathname: string | null): string | null | undefined {
  if (!pathname || pathname === "/" || pathname === "") {
    return null
  }
  const entries = Object.entries(routePermissions).sort(
    (a, b) => b[0].length - a[0].length,
  )
  for (const [path, perm] of entries) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return perm
    }
  }
  return undefined
}
