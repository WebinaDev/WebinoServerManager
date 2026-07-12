---
sidebar_position: 1
---

# WebinoServer API

API-first hosting control panel. All endpoints are versioned under `/api/v1`.

## Authentication

- `POST /api/v1/auth/login` — email, password, optional `otp` for 2FA
- `GET /api/v1/auth/check` — session check (Sanctum cookie)
- `POST /api/v1/auth/logout`

## Domains

- `GET /api/v1/domains`
- `POST /api/v1/domains` — `{ "domain", "slug?", "aliases?" }`
- `DELETE /api/v1/domains/{id}`

## Databases

- `GET /api/v1/databases`
- `POST /api/v1/databases` — `{ "name", "create_user?" }`
- `DELETE /api/v1/databases/{id}`

## Platform

- `GET /api/v1/platform/status`
- `POST /api/v1/platform/init`
- `GET /api/v1/sites`
- `POST /api/v1/sites`

See module routes for DNS, SSL, FTP, Email, Files, Cron, Backup, System, Git, WordPress, and Support.
