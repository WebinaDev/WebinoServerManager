# Soft Store

Seeded catalog of allowlisted host packages (not aaPanel commercial downloads). Installs are queued on `panel-worker` and executed by the Go agent via fixed `script_id` values only.

## Packages (seed)

| Slug | Category | Agent script |
|------|----------|--------------|
| `redis` | runtime | `install_redis` |
| `memcached` | runtime | `install_memcached` |
| `composer` | tool | `ensure_composer` |
| `wordpress-cms` | cms | `install_wordpress_cms` (requires `website_id` → docroot) |
| `docker-redis` | docker | `compose_up_redis` |
| `docker-nginx` | docker | `compose_up_nginx` |
| `node-nvm` | runtime | `install_node_nvm` |
| `python-distro` | runtime | `install_python_distro` |
| `go-distro` | runtime | `install_go_distro` |
| `java-distro` | runtime | `install_java_distro` |

Catalog rows are seeded on migrate and re-seeded idempotently from `SoftstoreServiceProvider::boot()`.

## Tables

- `softstore_packages`
- `softstore_installs` — status `pending` / `running` / `success` / `failed`
- `softstore_pins` — per-user dashboard shortcuts

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/softstore/packages` | auth (+ host probe) |
| POST | `/api/v1/softstore/packages/{slug}/install` | `system.manage` |
| GET | `/api/v1/softstore/installs` | auth |
| GET | `/api/v1/softstore/installs/{id}` | auth |
| GET/POST/DELETE | `/api/v1/softstore/pins` | auth |
| GET | `/api/v1/dashboard/summary` | includes `softstore_pins`, `softstore_active_installs` |

## Agent

- `GET /v1/softstore/status?packages=redis,memcached,...`
- `POST /v1/softstore/install` body `{script_id, options}` — allowlist only

## UI

- `/softstore` — catalog, pin, install progress
- Dashboard Home — pin row + active install count
