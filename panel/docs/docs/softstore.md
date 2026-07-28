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
| `nginx` / `apache` | stack | `install_nginx` / `install_apache` |
| `mariadb` / `mysql` | stack | `install_mariadb` / `install_mysql` |
| `php-fpm-81`…`84` | stack | `install_php_fpm_8x` |
| `ufw` / `fail2ban` / `pureftpd` | stack | `ensure_ufw_baseline` / `ensure_fail2ban` / `install_pureftpd` |

Catalog rows are seeded on migrate and re-seeded idempotently from `SoftstoreServiceProvider::boot()`. Stack packages are also driven by the **first-run setup wizard**.

## Install hardening (agent)

All apt-backed Softstore/setup scripts:

1. Enable Ubuntu **universe** (best-effort) and `apt-get update`
2. Run with `DEBIAN_FRONTEND=noninteractive` and dpkg `force-confdef/old`
3. Use package fallbacks where distros differ:
   - MariaDB/MySQL: `mariadb-server` → `default-mysql-server` → `mysql-server`
   - Redis: `redis-server` → `redis`
   - Composer: distro package → getcomposer.org PHAR
   - PHP non-default versions: add `ppa:ondrej/php` then retry
   - Java: OpenJDK 17 → 21 → `default-jdk`
   - Go: `golang-go` → `golang`
4. Enable/start systemd units after install (nginx, php-fpm, redis, fail2ban, …)

See [TROUBLESHOOTING.md](../../../docs/TROUBLESHOOTING.md) for common “no installation candidate” cases.

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
