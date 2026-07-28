# WebinoServer Troubleshooting

English reference for common errors during bootstrap, platform setup, site management, and the hosting panel stack.

## Bootstrap / install

| Error | Cause | Fix |
|-------|-------|-----|
| `PHP 8.3+ is required for local mode` | Old installer used local headless on curl pipe | Pull latest code; bootstrap uses `--server --yes` then opens control panel |
| `Docker is required but not installed` | Docker auto-install failed (or old installer only used `get.docker.com`) | Installer prefers **distro** packages: `apt-get install -y docker.io docker-compose-v2 && systemctl enable --now docker` then re-run bootstrap. If `download.docker.com` returns **403**, do **not** use `get.docker.com` — that path is blocked. Optional CE only when reachable: `WEBINO_DOCKER_CE=1 ./install.sh --server --yes` |
| `403 Forbidden` / `InRelease` on `download.docker.com` | Docker Inc. apt repo blocked (common on restricted networks) | Latest installer falls back to `docker.io`. Manual: disable broken lists under `/etc/apt/sources.list.d/*docker*` then `apt-get update && apt-get install -y docker.io docker-compose-v2` |
| `unknown shorthand flag: 'f' in -f` | Docker installed without Compose v2 plugin | Installer auto-installs `docker-compose-v2` / plugin / GitHub binary; manual: `apt-get install -y docker-compose-v2` or re-run `./install.sh --panel` |
| `Docker Compose is not working` | `docker.io` without compose v2 | `apt-get install -y docker-compose-v2` (preferred) or GitHub Compose plugin binary (see row below) |
| `Docker Compose command check failed` | Broken `docker-compose` v1 shim on PATH, or plugin missing on pre-installed `docker.io` | Installer tries apt (`docker-compose-v2`, `docker-compose-plugin`), then GitHub plugin binary (`WEBINO_COMPOSE_VERSION`). Manual diagnose: `docker compose version`; `docker-compose version`; `ls /usr/local/lib/docker/cli-plugins/`. Binary fallback: `mkdir -p /usr/local/lib/docker/cli-plugins && curl -fSL https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-$(uname -m) -o /usr/local/lib/docker/cli-plugins/docker-compose && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose` |
| `Preflight checks failed` | Missing deps after auto-install | Read `Fix:` lines printed below each issue |
| `git is required` / git install failed | Minimal OS, no package manager | `apt install -y git` (Debian/Ubuntu) |
| `Target path exists but is not a git repo` | `./WebinoServerManager` exists as file/folder | `rm -rf WebinoServerManager` or `WEBINO_INSTALL_DIR=/opt/webinoserver curl ... \| bash` |
| `Server preflight failed` | Missing python3 or envsubst | Installer should auto-install; manual: `apt install -y python3 gettext-base` |
| Control panel did not open after curl pipe | No `/dev/tty` (CI, non-SSH) | Connect via SSH and run `webina` — first-run wizard opens automatically |
| Control panel did not open after curl pipe | Running from cron/script | Use interactive SSH session for first site creation |
| `Recv failure: Connection reset by peer` / `SSL connection timeout` | Package server unreachable during git fetch | Retry; or `WEBINO_SKIP_UPDATE=1`; or `cd WebinoServerManager && ./install.sh --server --yes` |
| `Operation too slow. Less than 1000 bytes/sec` | Old bootstrap enforced git low-speed limit | Pull latest bootstrap; or manual clone from GitHub |
| `cd: ./WebinoServerManager: No such file or directory` | Download failed but bootstrap continued | Pull latest bootstrap (validates before cd); manual clone below |
| `Your local changes ... would be overwritten by merge` | Old bootstrap used `git pull` on a dirty clone | Latest bootstrap uses fetch + hard reset. Manual: `cd WebinoServerManager && git fetch origin main && git reset --hard origin/main` |
| Slow bootstrap / repeated git retries | Old bootstrap retried failed git pull/fetch | Latest bootstrap: tarball from GitHub first |
| `stderr_file: unbound variable` | Old bootstrap RETURN trap + `set -u` bug | Pull latest bootstrap.sh; or `cd WebinoServerManager && ./install.sh --server --yes` |
| Install takes 10–20+ minutes first time | Docker image build (backend + Next.js) | Normal on first install; re-runs skip build if images exist |
| `webina` clears screen, no dialog | Platform libs not loaded or dialog failed | Pull latest code; run `cd WebinoServerManager && ./install.sh --tui`. Falls back to text menu automatically |
| `platform_is_initialized: command not found` | Platform libraries not loaded | Pull latest `webina` / `load.sh` fix |
| Dialog does not appear during bootstrap | Used `curl \| bash` without TTY re-attach (old bootstrap) | Use recommended: `bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh)` or pull latest bootstrap |
| Slow git clone on fresh VPS | Git protocol throttled from region | Latest bootstrap uses tarball from GitHub first; git is fallback |
| Hangs on "Downloading WebinoServerManager..." | GitHub archive unreachable or curl with no timeout | Progress shows elapsed time; fails within ~2 min. Verify archive: `curl -I https://github.com/WebinaDev/WebinoServerManager/archive/refs/heads/main.tar.gz` (expect 200). Run `./scripts/verify-package-server.sh` |
| `--full` installs platform but panel never starts | Old server-bootstrap exec'd TUI before panel step | Pull latest code; `./install.sh --server --panel --yes` or re-run `./install.sh --panel` |
| `Panel compose failed` / mount `not a directory` on `phppgadmin/config.inc.php` | Embed config files missing from repo; Docker created directories instead of files | `rm -rf panel/docker/phpmyadmin/config.user.inc.php panel/docker/phpmyadmin/signon.php panel/docker/phppgadmin/config.inc.php panel/docker/phppgadmin/signon.php panel/docker/roundcube/config.inc.php` then pull latest and `./install.sh --panel` |
| Page refreshes rapidly after setup (`/login` ↔ `/setup`) | Middleware treated unreachable API as setup-only; client redirected back to login | Pull latest and rebuild: `sudo -E ./scripts/update-server.sh --panel --yes` (see README — Update & rebuild) |
| `Root or passwordless sudo required` | Bootstrap run as non-root without sudo | `sudo bash <(curl -fsSL .../bootstrap.sh) --full` |

## Install commands (TTY)

| Command | TTY | What you get |
|---------|-----|--------------|
| `bash <(curl -fsSL .../bootstrap.sh) --full` | Yes (recommended VPS) | Docker + platform + web panel `:2090` |
| `curl -fsSL .../bootstrap.sh \| bash -s -- --full` | Pipe / CI | Same full stack, non-interactive |
| `bash <(curl -fsSL .../bootstrap.sh)` | Yes | Platform + TUI wizard (no web panel) |
| `curl -fsSL .../bootstrap.sh \| bash` | Re-attached via latest bootstrap | Same after auto re-exec |

Both bootstrap commands run the same installer. Prefer `--full` on a fresh VPS. Use process substitution for fastest interactive UX (like Hiddify / 3x-ui).

Fresh install downloads a **tarball** from [GitHub — WebinaDev/WebinoServerManager](https://github.com/WebinaDev/WebinoServerManager) (no git required). Git is only used as fallback or for updating git-based installs.

## Control panel (webina / dialog)

| Error | Cause | Fix |
|-------|-------|-----|
| Blank terminal after `webina` | `dialog --clear` failed silently | Pull latest code (text menu fallback). Or: `unset DIALOGRC; TERM=xterm-256color ./install.sh --tui` |
| Purple dialog never appears | `dialog` missing or bad `DIALOGRC` | `apt install -y dialog`. Test menu capture: `choice=$(dialog --menu "test" 10 40 2 1 ok 2 cancel 2>&1 >/dev/tty); echo "$choice"` |
| Text menu instead of dialog | Self-test failed (no TTY or bad DIALOGRC) | Pull latest `tui.sh` (no invalid `--tty` flag). Ensure SSH session: `echo $TERM` not `dumb`. Install dialog: `apt install -y dialog` |
| Esc shows "dialog unavailable" | Old main menu treated Esc as dialog failure | Pull latest `tui.sh` — Esc now exits cleanly |
| Control panel works via `./install.sh --tui` but not `webina` | TTY not attached | Pull latest `bin/webina` and `tui.sh` (always attach `/dev/tty`) |

Quick dialog test (same idiom as control panel):

```bash
dialog --msgbox "test" 5 20 >/dev/tty 2>/dev/tty </dev/tty
choice=$(dialog --menu "test" 10 40 2 1 ok 2 cancel 2>&1 >/dev/tty)
echo "choice=$choice TERM=$TERM"
```

Smoke test after install or recovery:

```bash
cd /path/to/WebinoServerManager && ./scripts/verify-control-panel.sh
```

Manual themed dialog test:

```bash
export DIALOGRC=/path/to/WebinoServerManager/scripts/dialogrc
choice=$(dialog --menu "test" 10 40 2 1 ok 2 cancel 2>&1 >/dev/tty)
echo "choice=$choice"
```

## Panel stack (hosting control panel)

The **WebinoServer panel** (`panel/`) is separate from the platform TUI (`webina`). It runs on port **2090** by default.

| Error | Cause | Fix |
|-------|-------|-----|
| Panel API not reachable on `:2090` | Stack not started or wrong port | `./install.sh --panel` or `webina panel`; check `docker compose --env-file panel/.env -f panel/docker-compose.panel.yml ps` |
| Panel API timeout; backend logs `Waiting for database at panel-db:3306` | `DB_HOST=panel-db` but Compose service is named `db` | Pull latest (compose sets `DB_HOST=db` + alias `panel-db`). Immediate: `sed -i 's/^DB_HOST=.*/DB_HOST=db/; s/^REDIS_HOST=.*/REDIS_HOST=redis/' panel/backend/.env` then `docker compose --env-file panel/.env -f panel/docker-compose.panel.yml up -d --force-recreate backend worker scheduler` |
| `Missing env file: .../panel/backend/.env` right after `Created ... from example` | `backend/.env` is a **directory** (Docker created it when compose mounted a missing file) | `rm -rf panel/backend/.env panel/.env` then `./install.sh --panel`. Latest installer auto-removes the directory and recreates the file. |
| Backend loops `Waiting for database at db:3306` (db container healthy) | MariaDB **volume** still has the old password; `.env` was regenerated (secrets recreated) so `MYSQL_PASSWORD` env is ignored on existing data dir | `WEBINO_PANEL_RESET_DB=1 ./install.sh --panel` (wipes panel DB). Manual: `docker compose --env-file panel/.env -f panel/docker-compose.panel.yml down && docker volume rm panel_panel_db_data && ./install.sh --panel`. Confirm `PANEL_DB_PASSWORD` in `panel/.env` equals `DB_PASSWORD` in `panel/backend/.env`. |
| Panel page is blank / black; install says API ready | (1) module routes were only `/v1/*` while browser/Caddy called `/api/v1/*`; (2) frontend `AppProviders` returned `null` until hydrate | Pull latest (`ModuleRoutes` registers `/api/v1` + `/v1`). Recreate: `docker compose --env-file panel/.env -f panel/docker-compose.panel.yml up -d --build --force-recreate backend web frontend`. Check: `curl -sf http://127.0.0.1:2090/api/v1/setup/status` returns JSON. Open `/setup`. |
| `The route api/v1/setup could not be found` | `/api/v1/*` not registered in running image / stale route cache on bind-mounted `bootstrap/cache` | Pull latest. On VPS: `bash scripts/install/patch-panel-api-routes.sh` **or** rebuild backend. Clear caches: `rm -f panel/backend/bootstrap/cache/routes*.php panel/backend/bootstrap/cache/config.php`. Verify with `docker exec webinoserver-backend php artisan route:list --path=setup` (not `--path=api/v1/setup`) and `curl -sf http://127.0.0.1:8080/api/v1/setup/status` **inside** the backend container. |
| Setup wizard loops / 409 on setup | Setup already completed | `GET /api/v1/setup/status` — if `needs_setup: false`, go to `/login` |
| Softstore / setup step fails with `invalid body` (Nginx failed first) | PHP sent `"options": []` but Go agent expects a JSON **object** `{}` | Pull latest — `RunSetupStackJob` sends `new \stdClass()`; agent also tolerates `[]`. Rebuild backend+agent+worker, then `POST /api/v1/setup/stack/retry`. |
| Setup stack: `Package 'mariadb-server' has no installation candidate` | Minimal Ubuntu cloud image without **universe** (or only MySQL metapackage) | Pull latest agent — Softstore apt installs enable **universe**, use `DEBIAN_FRONTEND=noninteractive`, and fall back (`mariadb-server` → `default-mysql-server` → `mysql-server`). Rebuild agent, then retry failed steps in `/setup/stack`. Manual: `apt-get update && apt-get install -y default-mysql-server`. |
| Softstore: `composer` / `redis-server` / `fail2ban` / `pure-ftpd` missing candidate | Same **universe** gap on minimal Ubuntu | Latest agent enables universe before apt install; Composer falls back to getcomposer.org PHAR; Redis tries `redis-server` then `redis`. Rebuild agent and retry the Softstore package. |
| Softstore PHP 8.1/8.2/8.4: no installation candidate on Ubuntu 24.04 | Distro only ships default PHP (often 8.3); other versions need **ondrej/php** | Latest agent adds `ppa:ondrej/php` when packages are missing, then retries FPM + extensions (core packages first if an extension fails). Rebuild agent and retry the PHP Softstore item. |
| Softstore Java/Go/Node (distro) install fails | Package name differs by Ubuntu/Debian release | Latest agent tries fallbacks: OpenJDK 17→21→`default-jdk`; `golang-go`→`golang`; NodeSource then distro `nodejs`. |
| phpMyAdmin / phpPgAdmin / Roundcube embed fails | `WEBINO_AGENT_TOKEN` mismatch between `panel/.env` and `panel/backend/.env` | Copy the same token to both files; recreate embed services. See [panel/docs/AGENT_SECURITY.md](../panel/docs/AGENT_SECURITY.md) |
| `network webino_platform ... could not be found` | Panel-only install without platform network | `docker network create webino_platform` or run `./install.sh --server --yes` first |
| `Package 'mysql-client' has no installation candidate` (panel-agent build) | Obsolete Debian package name in old agent Dockerfile | Pull latest WebinoServerManager and re-run `./install.sh --panel` |
| `go mod tidy` failed / proxy.golang.org timeout (panel-agent) | Go module proxy blocked | Latest agent Dockerfile sets GOPROXY with goproxy.io fallback |
| wp-cli download failed during panel-agent build | GitHub raw URL blocked | Latest Dockerfile retries wp-cli from GitHub releases |
| `libxml-2.0 >= 2.9.0` not found (panel-api/worker build) | Missing `libxml2-dev` before `docker-php-ext-install dom xml` | Pull latest WebinoServerManager; Dockerfile now installs `libxml2-dev` |
| `pdo_mysql` configure failed / libmysqlclient not found | Missing `default-libmysqlclient-dev` | Pull latest WebinoServerManager panel PHP Dockerfile |
| `pecl install redis` failed (autoconf/gcc not found) | Missing `$PHPIZE_DEPS` in panel PHP Dockerfile | Pull latest WebinoServerManager |
| `No releases available for package "pecl.php.net/redis"` | `pecl.php.net` blocked during Docker build (PECL channel, not APT) | Pull latest WebinoServerManager — Dockerfiles use `install-redis.sh` with GitHub phpredis fallback. Rebuild: `WEBINA_DOCKER_BUILD_NETWORK=host ./install.sh --panel` |
| `Required package "laravel/octane" is not present in the lock file` | `composer.lock` out of sync with `composer.json` | Pull latest WebinoServerManager — panel Dockerfile falls back to `composer update` during build. Or locally: `cd panel/backend && composer update` and commit `composer.lock` |
| `npm ci` fails / EUSAGE about `package-lock.json` on panel frontend | `@webina/ui` was a `file:` dep pointing outside the repo (monorepo path missing on VPS / Docker context) | Pull latest — UI is vendored at `panel/packages/webina-ui` (`file:../packages/webina-ui`). Host-network (`WEBINA_DOCKER_BUILD_NETWORK=host`) does **not** fix this. Rebuild: `cd panel && docker compose --env-file .env -f docker-compose.panel.yml build frontend` |
| `Your requirements could not be resolved` / `google2fa-laravel ... conflicts with ... ^13.7` | Satellite packages pinned to pre-Laravel 13 versions | Pull latest WebinoServerManager — `composer.json` uses L13 constraints (`octane ^2.17`, `laravel-modules ^13`, `laravel-permission ^7.2`, `scramble ^0.13`, base `pragmarx/google2fa ^8.0` instead of `google2fa-laravel`) |
| `contains a Composer plugin which is blocked by your allow-plugins config` | `nwidart/laravel-modules` needs `wikimedia/composer-merge-plugin` | Pull latest WebinoServerManager — `composer.json` allows `wikimedia/composer-merge-plugin` in `config.allow-plugins` |
| `Expression expected` in `usePermissions.ts` / `Unterminated regexp literal` | JSX in a `.ts` file (SWC does not parse JSX in `.ts`) | Pull latest WebinoServerManager — hook renamed to `usePermissions.tsx` |
| `Module not found: Can't resolve '@/lib/createPage'` | Wrong import path on forbidden page | Pull latest WebinoServerManager — use `@/lib/create-page` (matches `src/lib/create-page.tsx`) |
| `sqlite3 not found` / `pdo_sqlite` configure failed | Missing `libsqlite3-dev` (no longer bundled in PHP image) | Pull latest WebinoServerManager; Dockerfile now installs `libsqlite3-dev` |
| VPS still shows old Dockerfile errors after local fix | `curl bootstrap` pulls **main** from GitHub — fixes must be pushed to main first | Push/commit WebinoServerManager to main, then re-run bootstrap |
| Login works but API 401 | Cookie domain / `SANCTUM_STATEFUL_DOMAINS` wrong | Re-run panel install or set `APP_URL` / `FRONTEND_URL` to your panel URL in `panel/backend/.env` |

Full stack install (platform + panel):

```bash
cd WebinoServerManager && ./install.sh --server --panel --yes
```

Panel-only (no Caddy platform):

```bash
cd WebinoServerManager && ./install.sh --panel
```

## End-to-end verification (VPS)

After pushing latest code to the package server, run through this checklist on the VPS:

1. `bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh)` — welcome dialog appears, install completes
2. `webina` — dialog main menu (not text list); Esc exits cleanly
3. Platform Setup — network present + stack running; optional Repair/Restart offered when healthy
4. Create Site (slug + domain) — completes without Docker network error
5. Sites List → site detail — start/stop/logs/domain work
6. Delete site — returns to sites list (detail menu closes)
7. `./scripts/verify-control-panel.sh` — all checks OK
8. `webina platform repair` and `webina site list` / `webina site status SLUG` work from CLI

System Check in the control panel (menu option 7) runs both preflight and `verify-control-panel.sh`.

## Platform

| Error | Cause | Fix |
|-------|-------|-----|
| `Platform not initialized` | Bootstrap interrupted | Run `webina` — first-run wizard initializes platform |
| `envsubst is required` | gettext not installed | `apt install -y gettext-base` |
| `Permission denied /var/lib/webina` | Non-root without write access | Run as root or: `sudo mkdir -p /var/lib/webina && sudo chown $(id -u):$(id -g) /var/lib/webina` |
| `Port 80 is already in use` | nginx/apache on host | `systemctl stop nginx` or `systemctl stop apache2` |
| `Port 443 is already in use` | Another TLS service | `ss -tlnp \| grep :443` then stop conflicting service |
| Platform image build failed | Network, RAM, or Docker issue | Open control panel → Rebuild Platform Images. Add swap if OOM. |
| Caddy reload failed | Caddy container not ready | Control panel → Platform Logs → Caddy, or `docker restart webino-caddy` |
| `network webino_platform ... could not be found` | Platform stack down or Docker network deleted | Pull latest code; `webina` → Platform Setup → Start stack or Repair. Manual: `webina platform repair` or `docker network create webino_platform && cd /var/lib/webina/platform && docker compose -p webino-platform up -d` |
| Old platform compose (non-external network) | VPS has stale docker-compose.yml | `webina platform repair` or control panel → Platform Setup → Repair |
| `Platform images missing` | Images not built during init or pruned later | Installer and `webina site create` auto-build missing images. Manual: control panel → Rebuild Platform Images, or `webina platform rebuild` |
| Platform stack stopped after bootstrap | Init succeeded but Caddy/Redis containers exited | Re-run `./install.sh --server --yes` (auto-repair) or `webina platform repair` |
| `403 Forbidden` on `registry-1.docker.io` | Docker Hub blocked or rate-limited | Re-run `./install.sh --panel` — installer adds `mirror.gcr.io` automatically on pull failure |

## Docker Hub / image pull

Panel and platform stacks pull public images (`mariadb`, `redis`, `caddy`, etc.) from Docker Hub. In some regions Hub returns **403 Forbidden**, especially when BuildKit requests OCI **referrers** metadata:

```
GET https://registry-1.docker.io/v2/library/mariadb/referrers/sha256:...: 403 Forbidden
```

| Error | Cause | Fix |
|-------|-------|-----|
| `referrers/sha256 ... 403 Forbidden` | BuildKit attestations + blocked Hub | Re-run `./install.sh --panel` (auto-mirror) or set `WEBINA_DOCKER_REGISTRY_MIRROR=...` |
| `403 Forbidden` on `registry-1.docker.io` | Regional Hub block | Installer adds `https://mirror.gcr.io` to `/etc/docker/daemon.json` when direct pull fails |
| `referrers/sha256 ... 403` on mirror.gcr.io | containerd snapshotter fetches attestations | Fresh install auto-disables `containerd-snapshotter` only when no containers exist; otherwise manual mirror only |
| `Could not reach Docker Hub` but Hub returns 403 | Old preflight curl bug (fixed in latest) | Pull latest installer — preflight now detects 403 correctly |
| `go mod tidy` / `proxy.golang.org` timeout (panel-agent build) | Go module proxy blocked in region | Latest agent Dockerfile uses `GOPROXY=proxy.golang.org|goproxy.io|direct` |
| wp-cli download failed in panel-agent | raw.githubusercontent.com blocked | Latest Dockerfile retries GitHub releases URL as fallback |
| `Package 'mysql-client' has no installation candidate` | panel-agent Dockerfile on Debian bookworm | Pull latest WebinoServerManager; package is `mariadb-client` |
| Platform stack stopped after bootstrap | Compose up failed during image pull | `webina platform repair` or re-run `./install.sh --server --yes` |
| Manual mirror override | Corporate registry or alternate mirror | Set in `panel/.env`: `PANEL_MARIADB_IMAGE=mirror.gcr.io/library/mariadb:11` (see `panel/.env.example`) |

Environment variables:

| Variable | Purpose |
|----------|---------|
| `WEBINA_DOCKER_REGISTRY_MIRROR` | Override default mirror URL (default: `https://mirror.gcr.io`) |
| `WEBINA_DOCKER_SKIP_MIRROR_AUTO=1` | Disable automatic mirror setup; use VPN or manual pull |
| `BUILDKIT_NO_CLIENT_TOKEN=1` | Set by installer — reduces Hub referrer requests |
| `PANEL_*_IMAGE` | Override panel compose images (MariaDB, Redis, phpMyAdmin, etc.) |
| `PLATFORM_REDIS_IMAGE` / `PLATFORM_CADDY_IMAGE` | Override platform stack images |

Immediate workaround on a live VPS (before pulling latest installer):

```bash
cat >/etc/docker/daemon.json <<'EOF'
{ "registry-mirrors": ["https://mirror.gcr.io"] }
EOF
systemctl restart docker
docker pull mariadb:11 && docker pull redis:7-alpine
cd ~/WebinoServerManager && ./install.sh --panel
webina platform repair
```

## Product image build

When installing a product (`webina product install Webino`), Docker builds `docker/php/Dockerfile.platform` and `docker/next/Dockerfile`. First build takes 10–20 minutes.

| Error | Cause | Fix |
|-------|-------|-----|
| `apt-get update` failed in Dockerfile.platform | Broken IPv6, DNS inside Docker build, or blocked deb.debian.org | `WEBINA_DOCKER_BUILD_NETWORK=host webina product install Webino` |
| Build timeout / connection reset | Docker build network isolated from host | `WEBINA_DOCKER_BUILD_RETRY_HOST=1 webina product install Webino` |
| Debian mirror unreachable | Regional filtering of deb.debian.org | `WEBINA_APT_MIRROR=mirror.example/debian webina product install Webino` |
| `pecl install redis` failed / `No releases available for package pecl.php.net/redis` | PECL channel blocked or missing build deps | Pull latest Webino/WebinoERP — `install-redis.sh` falls back to GitHub phpredis source |
| `libxml-2.0 >= 2.9.0` not found in Dockerfile.platform | Missing `libxml2-dev` | Pull latest Webino/WebinoERP; Dockerfiles now include dev packages |
| `pdo_sqlite` / sqlite3 configure failed | Missing `libsqlite3-dev` | Pull latest Webino/WebinoERP; Dockerfiles now include `libsqlite3-dev` |
| `Backend image build failed for Webino` | Any of the above, or OOM | Check hints printed after failure; add swap if OOM |
| Image build OOM | Low RAM VPS (<2 GB free during build) | Add swap (`fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile`), then `webina product rebuild Webino` |

Environment variables:

| Variable | Purpose |
|----------|---------|
| `WEBINA_DOCKER_BUILD_NETWORK=host` | Use host network for `docker build` (fixes many DNS/NAT issues) |
| `WEBINA_DOCKER_BUILD_RETRY_HOST=1` | Retry failed build once with `--network=host` |
| `WEBINA_APT_MIRROR` | Replace `deb.debian.org` in product Dockerfiles during build |
| `WEBINA_REDIS_PECL_VERSION` | phpredis version for panel/product PHP images (default `6.0.2`) |
| `WEBINA_FORCE_APT_IPV4=0` | Disable ForceIPv4 apt config (default is `1`) |

## Sites / SSL

| Error | Cause | Fix |
|-------|-------|-----|
| SSL pending | DNS not pointed to server | Set A/AAAA record in control panel domain step; wait for propagation |
| `Site already exists` | Duplicate slug | Control panel → Sites List → Delete site, or pick new slug |
| `Invalid domain` | Spaces or invalid hostname | Use valid hostname in control panel: `shop.example.com` |
| Caddy 502 on `/api` | Backend container down | Control panel → site → Manage Containers → restart backend |
| Caddy 502 on frontend | Next container down | Control panel → site → Manage Containers → restart next |
| Backend bootstrap failed | Migrate/seed error | Control panel → site → View Logs → backend |
| Partial failed site (orphan dirs) | Create interrupted mid-way | `webina site delete SLUG --yes` then remove leftover dir under `/var/lib/webina/sites/` if needed |
| Default password still in use | Fresh site uses seed credentials | Change admin password immediately after first login |

## Container ops

| Error | Cause | Fix |
|-------|-------|-----|
| Redis connection refused | Platform Redis down | Control panel → Platform Setup / Status, or `docker restart webino-redis` |
| migrate failed / corrupt DB | Damaged sqlite | Control panel → Delete site and create again |
| Image build OOM | Low RAM VPS | Add swap, then control panel → Rebuild Platform Images |
| `webina: command not found` | CLI not linked | Use `/path/to/WebinoServerManager/bin/webina` (runtime install may still live under `/opt/WebinoServer`) |

## First-run wizard

After bootstrap, the control panel should open automatically and guide you through:

1. Platform initialization (if needed)
2. Create your first site (slug, domain, aliases) — **Webino** or **WebinoERM** product
3. Main control panel menu

If the wizard does not appear, run `webina` over SSH — it detects first run and launches the wizard.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WEBINO_PACKAGE_BASE` | `https://github.com` | Package host (GitHub default; set to legacy Gitea URL to override) |
| `WEBINO_PRODUCT` | `Webino` | Product to install: `Webino` or `WebinoERM` |
| `WEBINO_CHANNEL` | `Dev` | Version channel: `LTS`, `Beta`, or `Dev` |
| `WEBINO_REPO_SLUG` | `WebinaDev/WebinoServerManager` | Owner/repo on GitHub (orchestrator) |
| `WEBINO_REPO` | derived | Git clone URL |
| `WEBINO_BOOTSTRAP_URL` | derived | Raw bootstrap.sh URL |
| `WEBINO_BOOTSTRAP_MODE` | — | Set to `full` for platform + panel (same as `--full` flag) |
| `WEBINO_INSTALL_DOCKER=0` | — | Disable Docker auto-install (check only; default: auto-install ON via distro packages) |
| `WEBINO_DOCKER_CE=1` | — | Prefer Docker CE via `get.docker.com` (needs reachable `download.docker.com`; default is distro `docker.io` first) |
| `WEBINO_SKIP_DEPS=1` | — | Skip apt package installs (check only) |
| `WEBINO_SKIP_UPDATE=1` | — | Skip sync on existing install (use as-is; no hard reset) |
| `WEBINO_FORCE_REBUILD=1` | — | Force rebuild platform Docker images on init |
| `WEBINO_INSTALL_DIR` | `./WebinoServerManager` | Custom install directory for bootstrap |
| `WEBINO_DATA_ROOT` | `/var/lib/webina` | Override platform data path |
| `WEBINO_CURL_CONNECT_TIMEOUT` | `15` | Seconds before curl connect timeout during download |
| `WEBINO_CURL_MAX_TIME` | `120` | Max seconds per archive download attempt |

Custom fork example:

```bash
WEBINO_REPO_SLUG=your-org/WebinoServerManager \
  bash <(curl -fsSL https://raw.githubusercontent.com/your-org/WebinoServerManager/main/bootstrap.sh)
```

## Package server (GitHub)

If bootstrap hangs or fails during download, verify endpoints:

```bash
./scripts/verify-package-server.sh
```

Quick checks:

```bash
curl -I "https://github.com/WebinaDev/WebinoServerManager/archive/refs/heads/main.tar.gz"   # expect 200
git ls-remote https://github.com/WebinaDev/WebinoServerManager.git HEAD                   # expect SHA
```

Legacy Gitea override: set `WEBINO_PACKAGE_BASE=https://package.webina.dev` and `WEBINO_PACKAGE_BACKEND=gitea`. See [GITEA_PACKAGE_SERVER.md](GITEA_PACKAGE_SERVER.md).

## Sync on re-run

Bootstrap checks the package server with a fast `ls-remote` call (git installs) or commit SHA (tarball installs):

- **Already up-to-date** — skips download/fetch entirely (~1s)
- **Package server unreachable** — continues with existing install immediately (no retries)
- **Update available** — tarball re-download or single fetch + hard reset

Local edits inside `./WebinoServerManager` are discarded on sync by design. Set `WEBINO_SKIP_UPDATE=1` to keep the existing checkout unchanged.

## Install timing

| Phase | First install | Re-run (platform exists) |
|-------|---------------|--------------------------|
| Git sync | 1–10s (or skip if up-to-date) | ~1s if up-to-date |
| System deps | 1–3 min (Docker install) | Seconds (already installed) |
| Platform images | 10–20 min (one-time build) | Skipped if images exist |
| Platform stack | ~30s | ~30s if not running |

Server bootstrap prints step timings (e.g. `System dependencies ready (4s)`).

Immediate recovery:

```bash
# If ./WebinoServerManager already exists:
cd WebinoServerManager && ./install.sh --server --yes

# Or skip update on re-run:
WEBINO_SKIP_UPDATE=1 bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh)
```

## Fallback manual recovery

If the one-liner fails completely:

```bash
# Prefer distro packages (works when download.docker.com returns 403):
apt-get update
apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker

# If a failed get.docker.com left a broken apt source:
#   ls /etc/apt/sources.list.d/*docker*
#   mv /etc/apt/sources.list.d/docker*.list /etc/apt/sources.list.d/docker.list.webina-disabled
#   apt-get update

git clone https://github.com/WebinaDev/WebinoServerManager.git
cd WebinoServerManager
./install.sh --server --yes
# Control panel opens automatically; if not:
webina
```

Optional Docker CE only when `download.docker.com` is reachable:

```bash
WEBINO_DOCKER_CE=1 ./install.sh --server --yes
```

All site creation and management should be done inside the control panel — not via separate shell commands.
