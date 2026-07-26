---
sidebar_position: 2
---

# Core

Setup, authentication, navigation, dashboard, API tokens, 2FA, and terminal tickets.

## Setup wizard

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/setup/status` | `{ needs_setup }` |
| `POST` | `/api/v1/setup` | First admin user; fails with 409 if already done |

## Dashboard

`GET /api/v1/dashboard/summary` returns KPI counts (`domains`, `databases`, `sites`, `hosting_accounts`, `hosting_suspended`), `system_status`, CPU/mem/disk samples, NIC/Disk IO rates, `top_processes`, Softstore pins/recent installs, and a lightweight `security_risk` widget (firewall / fail2ban / ClamAV signals).

## Metrics history

`GET /api/v1/metrics/history` includes `net_rx_bps`, `net_tx_bps`, `disk_read_bps`, `disk_write_bps` when collected.

## Navigation

`GET /api/v1/navigation` — sidebar sections filtered by Spatie permissions.

## Two-factor authentication

Under `/api/v1/auth/2fa/*`: status, enable, confirm, disable, verify (login OTP). UI: **Security → 2FA**.

## API tokens

Scoped Sanctum tokens under `/api/v1/auth/tokens` (permission `tokens.manage`). UI: **Automation → API tokens**.

## Terminal

`POST /api/v1/terminal/ticket` issues a short-lived HMAC ticket for the agent WebSocket PTY. UI: **System → Terminal**.

## Trust boundary

Core auth and tokens are panel-only. Host metrics and terminal I/O go through the privileged Go agent (Unix socket + allowlisted routes). See [AGENT_SECURITY.md](../AGENT_SECURITY.md).
