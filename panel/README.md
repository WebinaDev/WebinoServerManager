# WebinoServer Panel

Laravel 13 API-first backend, Next.js 14.2.35 + shadcn frontend, Go `webino-agent`, and Docusaurus API docs.

## Quick start

**One-liner (VPS — platform + panel):**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh) --full
```

**Panel only** (hosting UI without platform TUI):

```bash
cd WebinoServerManager
./install.sh --panel
```

**Full stack** (platform + panel, from existing clone):

```bash
cd WebinoServerManager
./install.sh --server --panel --yes
```

### Prerequisites

- Docker and Docker Compose
- `webino_platform` Docker network — created automatically by `panel.sh` if missing; full-stack install creates it via server bootstrap

Always pass the panel env file when running compose manually:

```bash
docker compose --env-file panel/.env -f panel/docker-compose.panel.yml up -d
```

- Web UI: `http://<server-ip>:2090`
- API docs (dev only): `docker compose --env-file panel/.env -f panel/docker-compose.panel.yml --profile dev up -d` → `:2091`

Provisioning is fully automatic: `panel.sh` generates secrets, creates `webino_platform` network, patches URL/Sanctum/CORS for HTTP install, and the API entrypoint runs `composer install` (if needed), migrations, and role seed on startup.

**HTTP installs:** session cookies use `SESSION_SECURE_COOKIE=false` by default so login works on plain HTTP. Set `AUTH_COOKIE_SECURE=true` when terminating TLS.

See [docs/AGENT_SECURITY.md](docs/AGENT_SECURITY.md) for agent trust model, **token sync** between `panel/.env` and `panel/backend/.env`, and token rotation.

**Web server:** nginx + Apache dual-stack (`engine` per vhost/website); optional HTTP/3 (QUIC) on nginx only — see `docs/docs/webserver.md` and [AAPANEL_PARITY.md](AAPANEL_PARITY.md) Wave 2.

Embed failures (phpMyAdmin, phpPgAdmin, Roundcube) are often caused by `WEBINO_AGENT_TOKEN` mismatch — see [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md#panel-stack-hosting-control-panel).

## Structure

```
panel/
  backend/     Laravel 13 + Modules (Core, Domains, Databases, …)
  frontend/    Next.js + shadcn (login-04, sidebar-07, i18n fa/en)
  agent/       Go root daemon (unix socket)
  docs/        Docusaurus + AGENT_SECURITY.md
  docker/      Service Dockerfiles
  docker-compose.panel.yml
```

## First-run setup

After `install.sh --panel`, open the printed URL (e.g. `http://<server-ip>:2090`). The setup wizard creates the administrator account and basic panel settings. Optional `hostname` in the wizard updates `APP_URL` / CORS / Sanctum domains in `.env`.

## Update & rebuild

One command (auto-detects install dir, syncs latest code via git or tarball, preserves `.env`, rebuilds the panel):

```bash
curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/scripts/update-server.sh | WEBINA_DOCKER_BUILD_NETWORK=host WEBINA_DOCKER_BUILD_RETRY_HOST=1 bash -s -- --panel --yes
```

## Verify install

```bash
./scripts/verify-control-panel.sh
curl -sf http://localhost:2090/api/v1/setup/status
```
