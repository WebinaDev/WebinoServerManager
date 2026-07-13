# WebinoServer

Server orchestrator for the Webina platform. Manages Docker, Caddy (SSL), Redis, and multi-site deployments for **Webino** and **WebinoERM** products.

## Quick install (production VPS)

**Recommended — full stack** (Docker + platform + web panel on `:2090`):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh) --full
```

Non-interactive / pipe:

```bash
curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh | bash -s -- --full
```

**Platform only** (TUI control panel, no web panel):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh)
```

What happens with `--full`:

1. Downloads **WebinoServerManager** (this repo) — not a product
2. Installs Docker, python3, gettext, dialog (if missing)
3. Initializes platform stack (Caddy + Redis + shared network)
4. Registers the `webina` CLI
5. Starts the **web panel** at `http://<server-ip>:2090`

If Docker Hub is blocked in your region, panel/platform image pulls auto-configure `mirror.gcr.io` on failure (see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#docker-hub--image-pull)).

## Install modes

| Scenario | Command | What you get |
|----------|---------|--------------|
| **Full stack (VPS)** | `bash <(curl -fsSL .../bootstrap.sh) --full` | Docker + Caddy + Redis + web panel `:2090` + `webina` CLI |
| **Platform only** | `./install.sh --server --yes` | Caddy + Redis + `webina` CLI; manage sites via TUI |
| **Panel only** | `./install.sh --panel` or `webina panel` | Hosting panel UI on `:2090` (creates `webino_platform` network if missing) |
| **Full stack (local)** | `./install.sh --server --panel --yes` | Platform bootstrap, then panel stack |
| **Daily ops** | `webina` | Interactive dialog menu for sites and products |

After panel install, open `http://<server-ip>:2090` and complete the setup wizard. See [panel/README.md](panel/README.md).

## Update & rebuild (VPS)

Pull the latest code, rebuild the panel stack, and restart services (fixes setup/login refresh loops and panel Docker fixes after `git pull`):

```bash
cd ~/WebinoServerManager
export WEBINA_DOCKER_BUILD_NETWORK=host WEBINA_DOCKER_BUILD_RETRY_HOST=1
sudo -E ./scripts/update-server.sh --panel --yes
```

Full platform + panel sync from GitHub:

```bash
cd ~/WebinoServerManager
export WEBINA_DOCKER_BUILD_NETWORK=host WEBINA_DOCKER_BUILD_RETRY_HOST=1
sudo -E ./scripts/update-server.sh --full --yes
```

One-liner from any directory (downloads latest `update-server.sh` from GitHub):

```bash
export WEBINA_DOCKER_BUILD_NETWORK=host WEBINA_DOCKER_BUILD_RETRY_HOST=1
sudo -E bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/scripts/update-server.sh) --panel --yes
```

## Install products

Products are separate repositories. Install from the control panel (**Products**) or CLI:

```bash
webina product install Webino --channel Dev
webina product install WebinoERM --channel Dev
```

| Channel | Installs |
|---------|----------|
| **LTS** | Latest stable release |
| **Beta** | Latest prerelease |
| **Dev** | Latest `main` branch |

If product image build fails during `apt-get update` (common on VPS with broken IPv6 or restricted outbound):

```bash
WEBINA_DOCKER_BUILD_NETWORK=host webina product install Webino --channel Dev
# or auto-retry with host network:
WEBINA_DOCKER_BUILD_RETRY_HOST=1 webina product install Webino --channel Dev
# optional Debian mirror:
WEBINA_APT_MIRROR=mirror.example/debian webina product install Webino --channel Dev
```

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — Product image build.

## Create a site

```bash
webina site create --slug shop1 --domain shop1.example.com --product Webino
webina site create --slug webina --domain webina.dev --product WebinoERM
```

**WebinoERM** (corporate marketing site + ERP dashboard) bootstrap runs automatically: migrations, seed (`MarketingSiteSeeder`), `storage:link`. Default login: `admin@webina.local` / `password`. Public URLs have no locale prefix (`/`, `/blog`, `/dashboard`).

Optional WordPress import on create:

```bash
webina site create --slug webina --domain webina.dev --product WebinoERM \
  --env-patch-base64 "$(echo '{"MARKETING_IMPORT_WORDPRESS_URL":"https://webina.dev"}' | base64)"
```

**Webino** tenant sites still run `webino:provision-bootstrap` after seed. Default login: `admin@example.com` / `password`.

## Control panel

```bash
webina
```

| Option | Description |
|--------|-------------|
| Platform Setup / Status | Caddy + Redis stack |
| Sites List | Browse all sites |
| Create New Site | New isolated site (pick product) |
| Products | Install / update / rebuild Webino or WebinoERM |
| Platform Logs | Caddy and Redis logs |
| Rebuild Product Images | Rebuild Docker images for installed products |

## CLI reference

```bash
webina platform init|status|repair|logs|rebuild
webina product list|install|update|rebuild|status
webina site list|create|status|start|stop|restart|update|delete|logs|domain
webina container restart SLUG backend
```

## Data layout

```
/var/lib/webina/
  registry.json           # site index (with product per site)
  platform/               # Caddy + Redis + SSL certs
  products/
    Webino/               # cached Webino source
    WebinoERM/            # cached WebinoERM source
  sites/{slug}/           # per-site env, database, compose
```

## Monorepo / local development

When WebinoServerManager sits next to `WebinoDashboard/`, `Webino/`, `WebinoERM/`, or `WebinoERP/` (folder aliases), product install uses local sources automatically. Set `WEBINA_USE_LOCAL_PRODUCTS=0` to force download from GitHub.

## Project structure

```
bin/webina              Global CLI — opens control panel
bootstrap.sh            One-liner VPS installer
install.sh              Server bootstrap entry point
scripts/
  install/              Dependencies, preflight, CLI registration
  platform/             Multi-site Caddy/Redis platform
  products/             Product download and image builds
  tui/                  Interactive control panel (dialog)
docs/                   Troubleshooting and package server notes
```

## Web control panel

```bash
./install.sh --panel
# or
webina panel
```

Laravel API + Next.js/shadcn UI + Go agent + Docusaurus docs. See [panel/README.md](panel/README.md).
