---
sidebar_position: 22
---

# Platform & Products

Webino platform integration — distinct from hosting plans/accounts. Manages Webino product sites and container image installs via the `webina` CLI on the host.

Permission: `platform.manage` for mutations. UI: `/sites`, `/products`.

## Platform status

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/platform/status` | Webino runtime / bootstrap state |
| `POST` | `/api/v1/platform/init` | Initialize platform (one-time) |

## Sites (Webino sites)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/sites` | Live list via `webina site list` |
| `POST` | `/api/v1/sites` | `{ slug, ... }` create site |
| `DELETE` | `/api/v1/sites/{slug}` | Delete site (allowlisted agent action) |

UI: `/sites` — create, list, delete.

## Products

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/products` | Available Webino product images |
| `POST` | `/api/v1/products/install` | `{ product, ... }` trigger install |

UI: `/products`.

## Agent

`/v1/webina/sites` — list/create/delete with slug allowlist. Live host sync (not panel DB reconcile).

## Distinction

| Concept | Module | Purpose |
|---------|--------|---------|
| Hosting account | [Hosting](./hosting.md) | Shared hosting quotas, FTP/DB/mail |
| Webino site | Platform | Webino application instance |
| Hosting plan | Hosting | Resource limits for tenants |
| Product image | Products | Webino stack installable |
