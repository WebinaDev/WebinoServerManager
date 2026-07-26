---
sidebar_position: 9
---

# Monitoring

Services, grouped logs, uptime checks, notification channels, and process manager. Host ops via agent; checks and channels in panel MariaDB.

All routes require `permission:monitoring.manage`. UI: `/monitoring/*`.

## Services

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/monitoring/services` | Allowlisted systemd units + status |
| `POST` | `/api/v1/monitoring/services/action` | `{ unit, action: start\|stop\|restart\|reload }` |

Agent: allowlisted `systemctl` only. UI: `/monitoring/services`.

## Logs (Phase D grouped sources)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/monitoring/logs/sources` | `{ sources[], groups: { panel, site, ftp } }` |
| `GET` | `/api/v1/monitoring/logs` | `{ source, lines?, follow? }` — journalctl/tail |

Grouped sources separate panel nginx, per-site access/error, and FTP logs. UI: `/monitoring/logs`.

## Uptime

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/monitoring/uptime` | List HTTP/TCP checks |
| `GET` | `/api/v1/monitoring/uptime/{check}/results` | Probe history |
| `POST` | `/api/v1/monitoring/uptime` | Create check |
| `PATCH` | `/api/v1/monitoring/uptime/{check}` | Update target/interval |
| `DELETE` | `/api/v1/monitoring/uptime/{check}` | Remove |

Scheduler: `panel:check-uptime` every minute. Down transitions notify channels. UI: `/monitoring/uptime`.

## Notification channels

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/monitoring/channels` | Telegram, Slack, webhook, email |
| `POST` | `/api/v1/monitoring/channels` | Create channel |
| `PATCH` | `/api/v1/monitoring/channels/{channel}` | Update |
| `DELETE` | `/api/v1/monitoring/channels/{channel}` | Remove |
| `POST` | `/api/v1/monitoring/channels/{channel}/test` | Send test message |

Used by metric alerts, uptime failures, hosting quota breaches, and cron failure notifications. UI: `/monitoring/channels`.

## Processes (Wave 5)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/monitoring/processes?limit=` | TOP processes by CPU |
| `POST` | `/api/v1/monitoring/processes/kill` | `{ pid, signal: TERM\|KILL }` |

Agent: `GET/POST /v1/system/processes`. UI: `/monitoring/processes`.

## Agent endpoints

- `/v1/services` — systemctl list/action
- `/v1/logs` — tail with source allowlist + group metadata

## Related

- [Metrics](./metrics.md) — time-series samples and threshold alerts
- [System](./system.md) — live `/v1/system/info`
