---
sidebar_position: 1
---

# WebinoServer API

API-first hosting control panel. All endpoints are versioned under `/api/v1`.

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

## Domains

- `GET /api/v1/domains` — panel rows + optional agent registry
- `POST /api/v1/domains` — `{ domain, slug?, aliases?, hosting_account_id? }`
- `PATCH /api/v1/domains/{id}` — update aliases / hosting link
- `DELETE /api/v1/domains/{id}`

## Databases

- `GET /api/v1/databases`
- `POST /api/v1/databases` — `{ name, create_user?, hosting_account_id? }`
- `DELETE /api/v1/databases/{id}`

## Platform

- `GET /api/v1/platform/status`
- `POST /api/v1/platform/init`
- `GET /api/v1/sites`
- `POST /api/v1/sites`

Module guides: [Core](./core.md), [Hosting](./hosting.md), [Users & RBAC](./users-rbac.md), [Security](./security.md), [Domains](./domains.md), [Subdomains](./subdomains.md). Live OpenAPI: [API explorer](./api).
