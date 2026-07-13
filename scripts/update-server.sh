#!/usr/bin/env bash
# Update WebinoServer on a VPS (bootstrap sync + panel/product rebuild).
set -euo pipefail

_SCRIPT_REF="${BASH_SOURCE[0]:-}"
case "$_SCRIPT_REF" in
  ""|bash|/dev/fd/*|/proc/self/fd/*|-)
    # Piped (curl | bash), process substitution, or stdin — no local dir.
    _SCRIPT_DIR=""
    ;;
  *)
    if [[ -f "$_SCRIPT_REF" ]]; then
      _SCRIPT_DIR="$(cd "$(dirname "$_SCRIPT_REF")" && pwd)"
    else
      _SCRIPT_DIR=""
    fi
    ;;
esac

_update_valid_root() {
  [[ -n "$1" && -f "${1}/install.sh" && -d "${1}/scripts/install" ]]
}

ROOT=""
if [[ -n "$_SCRIPT_DIR" ]]; then
  _candidate="$(cd "${_SCRIPT_DIR}/.." && pwd)"
  _update_valid_root "$_candidate" && ROOT="$_candidate"
fi

if [[ -z "$ROOT" && -n "${WEBINO_INSTALL_DIR:-}" ]]; then
  _update_valid_root "$WEBINO_INSTALL_DIR" && ROOT="$WEBINO_INSTALL_DIR"
fi

if [[ -z "$ROOT" ]]; then
  _INSTALL_PATH_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/webina/install-path"
  if [[ -f "$_INSTALL_PATH_FILE" ]]; then
    _candidate="$(tr -d '\n' <"$_INSTALL_PATH_FILE")"
    _update_valid_root "$_candidate" && ROOT="$_candidate"
  fi
fi

if [[ -z "$ROOT" ]]; then
  for _candidate in "$HOME/WebinoServerManager" "$PWD/WebinoServerManager" "$PWD"; do
    if _update_valid_root "$_candidate"; then
      ROOT="$_candidate"
      break
    fi
  done
fi

webino_update_load_package_urls() {
  if [[ -f "${ROOT}/scripts/install/package-urls.sh" ]]; then
    # shellcheck source=scripts/install/package-urls.sh
    source "${ROOT}/scripts/install/package-urls.sh"
    return 0
  fi

  local slug="${WEBINO_REPO_SLUG:-WebinaDev/WebinoServerManager}"
  local branch="${WEBINO_BRANCH:-main}"
  local tmp
  tmp=$(mktemp)
  if ! curl -fsSL \
    --connect-timeout "${WEBINO_CURL_CONNECT_TIMEOUT:-15}" \
    --max-time "${WEBINO_CURL_MAX_TIME:-120}" \
    "https://raw.githubusercontent.com/${slug}/${branch}/scripts/install/package-urls.sh" \
    -o "$tmp"; then
    rm -f "$tmp"
    printf '\033[1;31m[update-server]\033[0m Failed to fetch scripts/install/package-urls.sh\n' >&2
    exit 1
  fi
  # shellcheck source=/dev/null
  source "$tmp"
  rm -f "$tmp"
}

webino_update_load_package_urls
BOOTSTRAP_URL="$(webino_package_bootstrap_url "$WEBINO_REPO_SLUG" main)"

log() { printf '\033[1;34m[update-server]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[update-server]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[update-server]\033[0m %s\n' "$*" >&2; exit 1; }

_update_valid_root "$ROOT" || die "Could not locate a WebinoServerManager install (with install.sh).
Run this from inside the checkout, or set WEBINO_INSTALL_DIR=/path/to/WebinoServerManager.
Fresh install: git clone https://github.com/WebinaDev/WebinoServerManager.git && cd WebinoServerManager && ./install.sh --panel --yes"

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
  ./scripts/update-server.sh --panel --yes
  ./scripts/update-server.sh --full --yes

One-liner (from any directory; auto-detects install dir, syncs code, rebuilds):
  curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/scripts/update-server.sh | WEBINA_DOCKER_BUILD_NETWORK=host WEBINA_DOCKER_BUILD_RETRY_HOST=1 bash -s -- --panel --yes
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

run_root() {
  if [[ "${EUID:-0}" -eq 0 ]]; then
    WEBINA_DOCKER_BUILD_NETWORK="$WEBINA_DOCKER_BUILD_NETWORK" \
    WEBINA_DOCKER_BUILD_RETRY_HOST="$WEBINA_DOCKER_BUILD_RETRY_HOST" \
      "$@"
    return
  fi
  if sudo -n true 2>/dev/null; then
    sudo WEBINA_DOCKER_BUILD_NETWORK="$WEBINA_DOCKER_BUILD_NETWORK" \
         WEBINA_DOCKER_BUILD_RETRY_HOST="$WEBINA_DOCKER_BUILD_RETRY_HOST" \
      "$@"
    return
  fi
  "$@"
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

# Files that must never be overwritten during a code sync (secrets/state).
_SYNC_PRESERVE=(
  ".env"
  "panel/.env"
  "panel/backend/.env"
  "panel/frontend/.env"
)

# Embed mount targets Docker may have auto-created as directories; the repo
# ships them as files, so a stale directory breaks the file copy and the mount.
_SYNC_EMBED_FILES=(
  "panel/docker/phpmyadmin/config.user.inc.php"
  "panel/docker/phpmyadmin/signon.php"
  "panel/docker/phppgadmin/config.inc.php"
  "panel/docker/phppgadmin/signon.php"
  "panel/docker/roundcube/config.inc.php"
)

sync_tarball() {
  local tmpdir archive extract_dir url downloaded=0 rel
  local -a archive_urls=()
  mapfile -t archive_urls < <(webino_package_archive_urls "$WEBINO_REPO_SLUG" "$WEBINO_BRANCH")

  tmpdir=$(mktemp -d)
  archive="$tmpdir/archive.tar.gz"
  log "Downloading latest source (${WEBINO_BRANCH})..."
  for url in "${archive_urls[@]}"; do
    if curl -fL --connect-timeout "${WEBINO_CURL_CONNECT_TIMEOUT:-15}" \
      --max-time "${WEBINO_CURL_MAX_TIME:-120}" --retry 1 --retry-delay 2 \
      -o "$archive" "$url" 2>/dev/null; then
      downloaded=1
      break
    fi
  done
  [[ "$downloaded" -eq 1 && -s "$archive" ]] || { rm -rf "$tmpdir"; warn "Source download failed — using existing files"; return 1; }

  tar -xzf "$archive" -C "$tmpdir" || { rm -rf "$tmpdir"; warn "Extract failed — using existing files"; return 1; }
  extract_dir=$(find "$tmpdir" -mindepth 1 -maxdepth 1 -type d | head -1)
  [[ -n "$extract_dir" ]] || { rm -rf "$tmpdir"; warn "Empty archive — using existing files"; return 1; }

  # Remove stale Docker-created directories where the repo ships a file.
  for rel in "${_SYNC_EMBED_FILES[@]}"; do
    if [[ -d "${ROOT}/${rel}" && -f "${extract_dir}/${rel}" ]]; then
      rm -rf "${ROOT:?}/${rel}"
    fi
  done

  log "Applying update to ${ROOT} (preserving secrets)..."
  local -a rsync_excludes=()
  for rel in "${_SYNC_PRESERVE[@]}"; do
    rsync_excludes+=(--exclude "$rel")
  done

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --no-perms --chmod=ugo=rwX "${rsync_excludes[@]}" "${extract_dir}/" "${ROOT}/" \
      || { rm -rf "$tmpdir"; warn "rsync failed — using existing files"; return 1; }
  else
    cp -a "${extract_dir}/." "${ROOT}/" 2>/dev/null || true
    for rel in "${_SYNC_PRESERVE[@]}"; do
      if [[ -f "${ROOT}/${rel}.updsync.bak" ]]; then
        mv -f "${ROOT}/${rel}.updsync.bak" "${ROOT}/${rel}"
      fi
    done
  fi

  rm -rf "$tmpdir"
  chmod +x "${ROOT}/install.sh" "${ROOT}/bootstrap.sh" "${ROOT}/bin/webina" 2>/dev/null || true
  find "${ROOT}/scripts" -name '*.sh' -exec chmod +x {} + 2>/dev/null || true
  log "Source updated."
  return 0
}

sync_code() {
  if [[ -d "$ROOT/.git" ]]; then
    log "Syncing git checkout at ${ROOT}..."
    git -C "$ROOT" fetch origin "$WEBINO_BRANCH" \
      && git -C "$ROOT" reset --hard "origin/${WEBINO_BRANCH}" \
      || warn "Git sync failed — continuing with existing files"
  else
    sync_tarball || true
  fi
}

bootstrap_full() {
  verify_package_server
  log "Running bootstrap --full..."
  if [[ "$SKIP_UPDATE" == "1" ]]; then
    export WEBINO_SKIP_UPDATE=1
  fi
  local bootstrap_tmp
  bootstrap_tmp=$(mktemp)
  curl -fsSL "$BOOTSTRAP_URL" -o "$bootstrap_tmp"
  chmod +x "$bootstrap_tmp"
  run_root bash "$bootstrap_tmp" --full ${INSTALL_YES[@]+"${INSTALL_YES[@]}"}
  rm -f "$bootstrap_tmp"
}

rebuild_panel() {
  log "Rebuilding panel stack..."
  run_root bash "$ROOT/install.sh" --panel ${INSTALL_YES[@]+"${INSTALL_YES[@]}"}
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
      sync_code
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
