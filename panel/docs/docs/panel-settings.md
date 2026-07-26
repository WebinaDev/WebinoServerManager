# Panel Settings hub (Wave 12)

## Navigation

- `/settings` — hub linking profile, 2FA, API tokens
- Network + maintenance cards for `system.manage` users

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/panel/settings` | read-open |
| PATCH | `/api/v1/panel/settings/network` | `system.manage` |
| POST | `/api/v1/panel/restart` | `system.manage` (confirm `RESTART`) |
| POST | `/api/v1/panel/reboot/confirm` | `system.manage` |
| POST | `/api/v1/panel/reboot` | `system.manage` (token) |
| POST | `/api/v1/panel/repair` | `system.manage` |

## Agent

- `/v1/panel/settings` — bind domain, HTTP/HTTPS ports (Caddy config file)
- `/v1/panel/restart` — docker compose restart panel stack
- `/v1/panel/reboot` — `systemctl reboot`
- `/v1/panel/repair` — health socket, migrate, permission seed, report

Panel metadata stored in `panel_settings` (encrypted where needed).
