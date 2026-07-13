#!/usr/bin/env bash
# Update WebinoServer on a VPS (bootstrap sync + panel/product rebuild).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/install/package-urls.sh
source "${ROOT}/scripts/install/package-urls.sh"
BOOTSTRAP_URL="$(webino_package_bootstrap_url "$WEBINO_REPO_SLUG" main)"

MODE="panel"
SKIP_UPDATE=0
WITH_PRODUCTS=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Update WebinoServerManager from GitHub and rebuild services.

Options:
  --full            Bootstrap platform + panel (bootstrap.sh --full --yes)
  --panel           Rebuild panel only (default)
  --products        Update/rebuild products and recreate sites
  --skip-update     Do not sync code; rebuild with existing checkout
  --yes, -y         Non-interactive (passed to install.sh / bootstrap)
  -h, --help        Show this help

Environment (recommended on Iran VPS):
  WEBINA_DOCKER_BUILD_NETWORK=host
  WEBINA_DOCKER_BUILD_RETRY_HOST=1

Examples:
  export WEBINA_DOCKER_BUILD_NETWORK=host WEBINA_DOCKER_BUILD_RETRY_HOST=1
  sudo -E ./scripts/update-server.sh --full --yes
  sudo -E ./scripts/update-server.sh --panel --yes
  sudo -E ./scripts/update-server.sh --panel --products --yes
EOF
}

INSTALL_YES=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) MODE="full" ;;
    --panel) MODE="panel" ;;
    --products) WITH_PRODUCTS=1 ;;
    --skip-update) SKIP_UPDATE=1 ;;
    --yes|-y) INSTALL_YES=(--yes) ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

export WEBINA_DOCKER_BUILD_NETWORK="${WEBINA_DOCKER_BUILD_NETWORK:-host}"
export WEBINA_DOCKER_BUILD_RETRY_HOST="${WEBINA_DOCKER_BUILD_RETRY_HOST:-1}"

log() { printf '\033[1;34m[update-server]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[update-server]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[update-server]\033[0m %s\n' "$*" >&2; exit 1; }

run_root() {
  if [[ "${EUID:-0}" -eq 0 ]]; then
    "$@"
  elif sudo -n true 2>/dev/null; then
    sudo -E "$@"
  else
    "$@"
  fi
}

verify_package_server() {
  local url code
  mapfile -t _verify_urls < <(webino_package_archive_urls "$WEBINO_REPO_SLUG" "$WEBINO_BRANCH")
  url="${_verify_urls[0]}"
  code=$(curl -sI --connect-timeout 10 --max-time 30 "$url" | head -1 | awk '{print $2}')
  if [[ "$code" != "200" ]]; then
    warn "Package archive returned HTTP ${code:-unknown} (expected 200)."
    if [[ "$SKIP_UPDATE" != "1" && "$MODE" == "full" ]]; then
      die "Cannot bootstrap without package server. Use --skip-update or verify GitHub access."
    fi
  else
    log "Package archive OK (HTTP 200)"
  fi
}

sync_git_checkout() {
  if [[ -d "$ROOT/.git" ]]; then
    log "Syncing git checkout at ${ROOT}..."
    git -C "$ROOT" fetch origin main && git -C "$ROOT" reset --hard origin/main \
      || warn "Git sync failed — continuing with existing files"
  else
    warn "No .git in ${ROOT} — use --full for tarball bootstrap sync"
  fi
}

bootstrap_full() {
  verify_package_server
  log "Running bootstrap --full..."
  if [[ "$SKIP_UPDATE" == "1" ]]; then
    export WEBINO_SKIP_UPDATE=1
  fi
  run_root bash -c "bash <(curl -fsSL '$BOOTSTRAP_URL') --full ${INSTALL_YES[*]:-}"
}

rebuild_panel() {
  log "Rebuilding panel stack..."
  run_root "$ROOT/install.sh" --panel "${INSTALL_YES[@]}"
}

update_products() {
  command -v webina >/dev/null 2>&1 || die "webina CLI not found — run bootstrap --full first"
  local product slug
  for product in Webino WebinoERM; do
    if webina product status "$product" 2>/dev/null | grep -q 'Source:  ready'; then
      log "Updating and rebuilding ${product}..."
      WEBINA_REBUILD_ON_UPDATE=1 webina product update "$product" --channel Dev \
        || warn "Product update failed: ${product}"
    fi
  done
  while IFS= read -r slug; do
    [[ -n "$slug" ]] || continue
    log "Recreating site: ${slug}"
    webina site update "$slug" || warn "Site update failed: ${slug}"
  done < <(webina site list 2>/dev/null | awk 'NR>1 {print $1}' || true)
}

verify_panel() {
  local port="${PANEL_HTTP_PORT:-2090}"
  log "Verifying panel on port ${port}..."
  curl -sf --max-time 10 "http://127.0.0.1:${port}/api/v1/setup/status" >/dev/null \
    || die "Panel API not reachable at :${port}/api/v1/setup/status"
  local setup_code login_code
  setup_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:${port}/setup")
  login_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:${port}/login")
  log "HTTP setup=${setup_code} login=${login_code}"
  [[ "$setup_code" == "200" || "$setup_code" == "307" ]] \
    || warn "Unexpected /setup status: ${setup_code} (expected 200 or 307)"
  [[ "$login_code" == "200" || "$login_code" == "307" ]] \
    || warn "Unexpected /login status: ${login_code} (expected 200 or 307)"
  log "Panel verification passed"
}

case "$MODE" in
  full)
    bootstrap_full
    verify_panel
    ;;
  panel)
    if [[ "$SKIP_UPDATE" != "1" ]]; then
      verify_package_server || true
      sync_git_checkout
    else
      log "Skipping code sync (--skip-update)"
    fi
    rebuild_panel
    verify_panel
    ;;
esac

if [[ "$WITH_PRODUCTS" == "1" ]]; then
  update_products
fi

log "Update complete."
