#!/usr/bin/env bash
# Start WebinoServer web control panel stack.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PANEL="${ROOT}/panel"
COMPOSE="${PANEL}/docker-compose.panel.yml"
PANEL_ENV="${PANEL}/.env"
BACKEND_ENV="${PANEL}/backend/.env"

# shellcheck source=scripts/install/common.sh
source "${ROOT}/scripts/install/common.sh"
# shellcheck source=scripts/install/panel-secrets.sh
source "${ROOT}/scripts/install/panel-secrets.sh"
# shellcheck source=scripts/install/docker-registry.sh
source "${ROOT}/scripts/install/docker-registry.sh"
# shellcheck source=scripts/install/deps.sh
source "${ROOT}/scripts/install/deps.sh"

ensure_platform_network() {
  if ! docker network inspect webino_platform >/dev/null 2>&1; then
    log "Creating docker network webino_platform..."
    docker network create webino_platform
  fi
}

ensure_panel_secrets() {
  generate_panel_secrets "${PANEL}" 0
}

ensure_panel_runtime_dirs() {
  local backend="${PANEL}/backend"
  mkdir -p \
    "${backend}/storage/logs" \
    "${backend}/storage/framework/cache/data" \
    "${backend}/storage/framework/sessions" \
    "${backend}/storage/framework/views" \
    "${backend}/storage/app/public" \
    "${backend}/bootstrap/cache"
  chmod -R ug+rwx "${backend}/storage" "${backend}/bootstrap/cache" 2>/dev/null || true
}

panel_embed_mount_paths=(
  "${PANEL}/docker/phpmyadmin/config.user.inc.php"
  "${PANEL}/docker/phpmyadmin/signon.php"
  "${PANEL}/docker/phppgadmin/config.inc.php"
  "${PANEL}/docker/phppgadmin/signon.php"
  "${PANEL}/docker/roundcube/config.inc.php"
)

ensure_panel_embed_mounts() {
  local path
  for path in "${panel_embed_mount_paths[@]}"; do
    if [[ -d "$path" ]]; then
      die "Embed mount path is a directory (Docker auto-created it): ${path}
Remove it and re-run panel install:
  rm -rf ${path}
  git -C ${ROOT} checkout -- ${path#${ROOT}/}
Or pull latest WebinoServerManager and run: ./install.sh --panel"
    fi
    if [[ ! -f "$path" ]]; then
      die "Missing panel embed file: ${path}
Pull latest WebinoServerManager (panel/docker/*) and re-run: ./install.sh --panel"
    fi
  done
}

panel_compose_up() {
  local -a compose_args=(-f "$COMPOSE" --env-file "${PANEL_ENV}")
  local override=""
  if [[ -n "${WEBINA_DOCKER_BUILD_NETWORK:-}" || "${PANEL_DEV_BIND:-0}" == "1" ]]; then
    override=$(mktemp)
    {
      echo "services:"
      for svc in panel-api panel-scheduler panel-worker; do
        echo "  ${svc}:"
        if [[ -n "${WEBINA_DOCKER_BUILD_NETWORK:-}" ]]; then
          echo "    build:"
          echo "      network: ${WEBINA_DOCKER_BUILD_NETWORK}"
        fi
        if [[ "${PANEL_DEV_BIND:-0}" == "1" ]]; then
          cat <<'EOF'
    volumes:
      - ./backend:/var/www/html
      - webino_agent_sock:/run
      - webino_backups:/var/backups/webino
EOF
        fi
      done
    } >"$override"
    compose_args+=(-f "$override")
  fi
  webina_compose "${compose_args[@]}" up -d --build --pull missing
  local rc=$?
  [[ -n "$override" ]] && rm -f "$override"
  return "$rc"
}

panel_up() {
  ensure_system_deps
  have docker || die "Docker required for web panel"
  ensure_panel_secrets
  ensure_panel_runtime_dirs
  ensure_panel_embed_mounts
  ensure_platform_network

  export BUILDKIT_NO_CLIENT_TOKEN="${BUILDKIT_NO_CLIENT_TOKEN:-1}"
  export BUILDX_NO_DEFAULT_ATTESTATIONS="${BUILDX_NO_DEFAULT_ATTESTATIONS:-1}"
  export WEBINA_APT_MIRROR="${WEBINA_APT_MIRROR:-}"
  export WEBINA_FORCE_APT_IPV4="${WEBINA_FORCE_APT_IPV4:-1}"
  export WEBINA_DOCKER_BUILD_NETWORK="${WEBINA_DOCKER_BUILD_NETWORK:-}"
  export WEBINA_DOCKER_BUILD_RETRY_HOST="${WEBINA_DOCKER_BUILD_RETRY_HOST:-1}"

  panel_compose_prepull "${PANEL_ENV}" || die "Failed to pull panel stack images — see hints above"
  panel_build_prepull

  log "Starting WebinoServer panel (API + web + agent)..."
  if ! panel_compose_up; then
    if [[ "${WEBINA_DOCKER_BUILD_RETRY_HOST:-0}" == "1" && "${WEBINA_DOCKER_BUILD_NETWORK:-}" != "host" ]]; then
      warn "Panel compose up failed — retrying with host network..."
      export WEBINA_DOCKER_BUILD_NETWORK=host
      panel_compose_up || die "Panel compose failed — try: WEBINA_DOCKER_BUILD_NETWORK=host ./install.sh --panel"
    else
      die "Panel compose failed — try: WEBINA_DOCKER_BUILD_NETWORK=host WEBINA_DOCKER_BUILD_RETRY_HOST=1 ./install.sh --panel"
    fi
  fi
  wait_for_panel_api "$COMPOSE" "$PANEL_ENV" 120 || die "Panel API did not become ready — check: docker logs webinoserver-panel-api --tail 100"
  local ip port
  ip=$(panel_detect_ip)
  port="${PANEL_HTTP_PORT:-2090}"
  log "Panel ready: http://${ip}:${port}"
  log "Open this URL in your browser to complete the setup wizard."
  if [[ "${PANEL_DEV_PROFILE:-}" == "1" ]]; then
    log "API docs (dev profile): http://${ip}:${PANEL_DOCS_PORT:-2091}"
  else
    log "API docs: enable with PANEL_DEV_PROFILE=1 or docker compose --profile dev"
  fi
  log "Migrations and seed run automatically on panel-api startup."
  log "Agent security: see panel/docs/AGENT_SECURITY.md"
}

panel_status() {
  webina_compose -f "$COMPOSE" --env-file "${PANEL_ENV}" ps 2>/dev/null || webina_compose -f "$COMPOSE" ps
}

panel_down() {
  webina_compose -f "$COMPOSE" --env-file "${PANEL_ENV}" down 2>/dev/null || webina_compose -f "$COMPOSE" down
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-up}" in
    up) panel_up ;;
    status) panel_status ;;
    down) panel_down ;;
    *) die "Usage: panel.sh up|status|down" ;;
  esac
fi
