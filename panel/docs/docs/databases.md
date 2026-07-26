---
sidebar_position: 11
---

# Databases

MySQL/MariaDB, PostgreSQL, MongoDB, and Redis engines. Panel metadata in `hosting_databases`; provisioning via agent `/v1/databases*`.

Mutations require `permission:databases.manage`. UI: `/databases` + phpMyAdmin/phpPgAdmin embeds.

## List & create

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/databases` | Panel rows merged with agent list (all engines) |
| `POST` | `/api/v1/databases` | `{ name, engine?: mysql\|pgsql\|mongodb\|redis, create_user?, hosting_account_id? }` |
| `DELETE` | `/api/v1/databases/{database}` | Soft-delete to recycle bin |
| `GET` | `/api/v1/databases/{database}/size` | Live size from agent |

## Database users (MySQL)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/databases/users` | List DB users |
| `POST` | `/api/v1/databases/users` | `{ username, password, database_id, privileges? }` |
| `PATCH` | `/api/v1/databases/users/{user}` | Password / privileges |
| `DELETE` | `/api/v1/databases/users/{user}` | Drop user |

## Import / export

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/databases/import` | Upload dump; `{ database_id, file }` |
| `POST` | `/api/v1/databases/{database}/export` | Download `mysqldump` / `pg_dump` |

## Maintenance tools

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/databases/{database}/repair` | MySQL repair |
| `POST` | `/api/v1/databases/{database}/optimize` | MySQL optimize |
| `POST` | `/api/v1/databases/{database}/engine` | `{ engine: InnoDB\|MyISAM }` |

## Root password manager

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/databases/root-password` | `{ configured: bool }` |
| `POST` | `/api/v1/databases/root-password` | `{ password }` — encrypted in `panel_settings` |

## Remote access

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/databases/remote-access` | Allowed client IPs |
| `POST` | `/api/v1/databases/remote-access` | `{ ips }` grant remote MySQL |

## Recycle bin

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/databases/recycle` | Soft-deleted databases |
| `POST` | `/api/v1/databases/recycle/{databaseId}/restore` | Restore |
| `DELETE` | `/api/v1/databases/recycle/{databaseId}` | Purge permanently |

## Redis (Phase D)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/databases/redis/info` | `{ ping, memory_mb, info_memory }` via `redis-cli` |

## MongoDB (Phase D)

Create/list/drop via agent when `mongosh` is installed. Engine selector on create form.

## Agent

`/v1/databases` (GET list, POST create/destroy), `/v1/databases/users`, engine-specific actions. Reconcile every 15 min via `panel:reconcile-host`.
