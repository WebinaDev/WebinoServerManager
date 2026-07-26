---
sidebar_position: 20
---

# System

Live host information, disk analysis, and privileged panel maintenance (beyond the Settings hub UI).

Read-open GETs unless noted. Mutations require `permission:system.manage`.

## System info

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/system/info` | OS, CPU, RAM, disk, network, uptime — live from agent |

UI: `/system-info`.

## Disk analysis (Wave 6)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/system/disk` | Directory size tree sample |
| `POST` | `/api/v1/system/disk/cleanup` | `{ path }` — allowlisted tmp/cache paths only |

UI: `/system/disk`.

## Panel control (Wave 12)

See also [Panel Settings](./panel-settings.md).

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/panel/settings` | Bind domain, ports, SSL mode |
| `PATCH` | `/api/v1/panel/settings/network` | Update panel URL / Caddy config |
| `POST` | `/api/v1/panel/restart` | Restart panel Docker stack |
| `POST` | `/api/v1/panel/reboot/confirm` | Issue reboot confirmation token |
| `POST` | `/api/v1/panel/reboot` | `{ token }` — OS reboot |
| `POST` | `/api/v1/panel/repair` | Health check, migrate, permission seed |

UI hub: `/settings`.

## Agent

`/v1/system/info`, `/v1/system/disk`, `/v1/system/processes`, `/v1/panel/*`.

## Related modules

- [Monitoring](./monitoring.md) — services, logs, uptime, processes
- [Metrics](./metrics.md) — sampled history + alerts
- [Terminal](./terminal.md) — interactive shell
