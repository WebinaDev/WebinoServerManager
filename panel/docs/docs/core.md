---
sidebar_position: 2
---

# Core

Setup, authentication, navigation, dashboard, API tokens, 2FA, and terminal tickets.

## Setup wizard

First-run flow (aaPanel-style): administrator → panel settings → **recommended hosting software** → install progress on the host via the agent.

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/setup/status` | `needs_setup`, `setup_completed`, latest `stack` |
| `GET` | `/api/v1/setup/stack` | Poll install progress (`percent`, steps) |
| `POST` | `/api/v1/setup` | Create admin + start stack (or `stack.skip`); 409 if already done/in progress |
| `POST` | `/api/v1/setup/stack/retry` | Retry failed stack steps |

Default stack: Nginx, MariaDB, PHP 8.2+8.3, Composer, UFW (22/80/443/2090), Fail2ban; optional Redis/Memcached/Pure-FTPd. `setup_completed` is set only after stack success or explicit skip.

Tables: `setup_stack_runs`, `setup_stack_steps`.

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
