# WordPress Toolkit

WP-CLI operations for sites registered in panel DB (`wordpress_sites`). Host work runs via the Go agent at `/v1/wordpress` with fixed `wp` argv only (no user shell).

## Agent actions

| Action | Purpose |
|--------|---------|
| `install` / `delete` | Core install and remove (existing) |
| `clone` | Copy tree to `target_path` under `WEBINO_FILES_ROOT` |
| `migrate` | `wp search-replace` with `old_url` → `new_url` |
| `staging` | Clone + URL replace for `staging_domain` |
| `themes_list` / `themes_update` | List or update themes (`all` or `theme_slug`) |
| `plugins_list` / `plugins_update` | List or update plugins (`all` or `plugin_slug`) |
| `integrity` | `wp core verify-checksums` |

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/wordpress` | auth |
| POST | `/api/v1/wordpress` | `system.manage` |
| DELETE | `/api/v1/wordpress/{site}` | `system.manage` |
| GET | `/api/v1/wordpress/{site}/themes` | auth |
| GET | `/api/v1/wordpress/{site}/plugins` | auth |
| POST | `/api/v1/wordpress/{site}/integrity` | auth |
| POST | `/api/v1/wordpress/{site}/clone` | `system.manage` |
| POST | `/api/v1/wordpress/{site}/migrate` | `system.manage` |
| POST | `/api/v1/wordpress/{site}/staging` | `system.manage` |
| POST | `/api/v1/wordpress/{site}/themes/update` | `system.manage` |
| POST | `/api/v1/wordpress/{site}/plugins/update` | `system.manage` |

## UI

- `/wordpress` — install sites; select a site for toolkit (clone, migrate, staging, themes/plugins, integrity)

## Reconcile

`panel:reconcile-host` compares agent `GET /v1/wordpress` (wp-config discovery) with panel rows.
