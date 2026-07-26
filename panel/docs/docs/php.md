---
sidebar_position: 14
---

# PHP

PHP-FPM pool management, per-pool settings, php.ini editor, and extension toggles.

Mutations require `permission:system.manage`. UI: `/php-settings` (tabs: Pools | ini | Extensions).

## Pools

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/php/pools` | List pools + bound sites |
| `POST` | `/api/v1/php/pools` | `{ version, name?, settings? }` |
| `PATCH` | `/api/v1/php/pools/{pool}` | Update settings JSON → FPM conf |
| `DELETE` | `/api/v1/php/pools/{pool}` | Remove pool |

Settings keys are allowlisted in agent (`memory_limit`, `upload_max_filesize`, etc.). Paths jailed under pool root.

## php.ini

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/php/ini` | Current ini directives |
| `POST` | `/api/v1/php/ini` | `{ directives: { key: value } }` |

## Extensions

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/php/extensions` | `{ action: enable\|disable, extension }` |

## Agent

`/v1/php/pools`, `/v1/php/ini`, `/v1/php/extensions`. Per-site pool binding via Websites / Subdomains modules.
