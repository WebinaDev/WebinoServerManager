# Monitoring

Services, logs, uptime, notification channels, and process manager.

## Processes (Wave 5)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/monitoring/processes?limit=` | `monitoring.manage` |
| POST | `/api/v1/monitoring/processes/kill` | `monitoring.manage` body `{pid, signal: TERM\|KILL}` |

Agent: `GET/POST /v1/system/processes`.

UI: `/monitoring/processes`.

## Other

- Services: `/monitoring/services`
- Logs: `/monitoring/logs`
- Uptime: `/monitoring/uptime`
- Channels: `/monitoring/channels`
