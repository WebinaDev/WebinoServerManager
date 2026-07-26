---
sidebar_position: 1
---

# WebinoServer Panel API

API-first hosting control panel. All endpoints are versioned under `/api/v1`. The panel never mutates the host directly — privileged operations go through the Go **webino-agent** (Unix socket).

## Authentication

Login uses **username** (not email) plus password. Optional `otp` or recovery code for 2FA.

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/auth/login` | Sets HttpOnly auth cookie |
| `GET` | `/api/v1/auth/gate` | Pre-login / setup gate |
| `GET` | `/api/v1/auth/check` | Session check (Sanctum cookie) |
| `POST` | `/api/v1/auth/logout` | |
| `POST` | `/api/v1/auth/refresh` | Refresh session |
| `GET` | `/api/v1/auth/user` | Current user + prefs |
| `PATCH` | `/api/v1/auth/profile` | Profile / locale / timezone |
| `POST` | `/api/v1/auth/forgot-password` | |
| `POST` | `/api/v1/auth/reset-password` | |

See [Core](./core.md) for 2FA, API tokens, setup wizard, and dashboard summary.

## RBAC

Spatie permissions gate mutations (`RequireRouteWrite` on UI). Sensitive GETs require matching `*.manage` permission. Navigation filtered via `GET /api/v1/navigation`.

## Module guides

| Area | Guide |
|------|--------|
| Auth, dashboard, tokens | [Core](./core.md) |
| Hosting plans & accounts | [Hosting](./hosting.md) |
| Users & roles | [Users & RBAC](./users-rbac.md) |
| Firewall, WAF, ClamAV | [Security](./security.md) |
| Website hub | [Websites](./websites.md) |
| Domains & subdomains | [Domains](./domains.md), [Subdomains](./subdomains.md) |
| Nginx/Apache vhosts | [Webserver](./webserver.md) |
| App Store catalog | [Softstore](./softstore.md) |
| Docker & Compose | [Apps](./apps.md) |
| Node/Python/Go/Java | [Runtimes](./runtimes.md) |
| Email & webmail | [Email](./email.md) |
| Databases & embeds | [Databases](./databases.md), [Embed](./embed.md) |
| DNS & SSL | [DNS](./dns.md), [SSL](./ssl.md) |
| FTP, Cron (data plane) | [Data plane](./data-plane.md) |
| Files advanced | [Files](./files.md) |
| Monitoring & metrics | [Monitoring](./monitoring.md), [Metrics](./metrics.md) |
| Backups & mail polish | [Mail & Backup polish](./mail-backup-polish.md) |
| System & panel settings | [System](./system.md), [Panel Settings](./panel-settings.md) |
| Terminal | [Terminal](./terminal.md) |
| Webhooks & automation | [Webhooks](./webhooks.md) |
| Git & WordPress | [Git](./git.md), [WordPress](./wordpress.md) |
| Webino platform | [Platform & Products](./platform.md) |
| PHP pools | [PHP](./php.md) |

## Live OpenAPI

Interactive reference: [API explorer](./api). Regenerate spec: `cd panel/backend && composer openapi` (**267+ paths**). CI fails on drift (`openapi-export` job).

## aaPanel parity

Capability matrix and waves 0–12 + Phase D polish: [`AAPANEL_PARITY.md`](../../AAPANEL_PARITY.md) in the panel repo.

## Quick domain examples

**Domains**

- `GET /api/v1/domains` — panel rows + optional agent registry
- `POST /api/v1/domains` — `{ domain, slug?, aliases?, hosting_account_id? }`

**Databases**

- `GET /api/v1/databases` — all engines (MySQL, PG, MongoDB, Redis)
- `POST /api/v1/databases` — `{ name, engine?, create_user? }`

**Platform**

- `GET /api/v1/sites` — live Webino sites
- `GET /api/v1/platform/status` — bootstrap state

For the full path catalog, use the embedded Redoc explorer or exported `storage/app/openapi.json`.
