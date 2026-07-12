#!/usr/bin/env bash
# WebinoServer one-liner bootstrap — installs the server orchestrator (not products).
set -euo pipefail

WEBINO_PACKAGE_BASE="${WEBINO_PACKAGE_BASE:-https://package.webina.dev}"
WEBINO_REPO_SLUG="${WEBINO_REPO_SLUG:-webina/WebinoServer}"
BRANCH="${WEBINO_BRANCH:-main}"
REF="$BRANCH"
REPO="${WEBINO_REPO:-${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}.git}"
BOOTSTRAP_SELF_URL="${WEBINO_BOOTSTRAP_URL:-${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}/raw/branch/${BRANCH}/bootstrap.sh}"
TARGET="${WEBINO_INSTALL_DIR:-./WebinoServer}"
WEBINO_SKIP_UPDATE="${WEBINO_SKIP_UPDATE:-0}"
WEBINO_CURL_CONNECT_TIMEOUT="${WEBINO_CURL_CONNECT_TIMEOUT:-15}"
WEBINO_CURL_MAX_TIME="${WEBINO_CURL_MAX_TIME:-120}"

GIT_HTTP_OPTS=( -c http.postBuffer=524288 )

if [[ ! -t 0 && -e /dev/tty ]]; then
  exec bash <(curl -fsSL "$BOOTSTRAP_SELF_URL") "$@" </dev/tty >/dev/tty 2>&1
fi

log() { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bootstrap]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[bootstrap]\033[0m %s\n' "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

bootstrap_has_flag() {
  local flag="$1"
  shift
  local arg
  for arg in "$@"; do
    [[ "$arg" == "$flag" ]] && return 0
  done
  return 1
}

bootstrap_full_mode() {
  [[ "${WEBINO_BOOTSTRAP_MODE:-}" == "full" ]] && return 0
  bootstrap_has_flag --full "$@"
}

bootstrap_ensure_curl_tar() {
  have curl && have tar && return 0
  log "Installing curl and tar..."
  if have apt-get; then
    apt-get update -qq && apt-get install -y curl tar
  elif have dnf; then
    dnf install -y curl tar
  elif have yum; then
    yum install -y curl tar
  elif have pacman; then
    pacman -Sy --noconfirm curl tar
  fi
  have curl && have tar
}

bootstrap_ensure_dialog() {
  have dialog && return 0
  if have apt-get; then
    apt-get install -y dialog 2>/dev/null || return 1
  elif have dnf; then
    dnf install -y dialog 2>/dev/null || return 1
  elif have yum; then
    yum install -y dialog 2>/dev/null || return 1
  elif have pacman; then
    pacman -Sy --noconfirm dialog 2>/dev/null || return 1
  fi
  have dialog
}

bootstrap_require_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    return 0
  fi
  if have sudo && sudo -n true 2>/dev/null; then
    return 0
  fi
  die "WebinoServer bootstrap requires root (or passwordless sudo).
  Fix: sudo bash <(curl -fsSL ${BOOTSTRAP_SELF_URL}) --full"
}

bootstrap_show_welcome() {
  bootstrap_ensure_dialog || true
  if have dialog && [[ -t 1 ]] && [[ "${TERM:-dumb}" != "dumb" ]]; then
    dialog --title "WebinoServer" --msgbox \
      "Welcome to WebinoServer installer.\n\nThis installs the server orchestrator (control panel, platform stack).\nProducts (Webino, WebinoERM) are installed separately from the control panel." \
      12 72 </dev/tty >/dev/tty 2>&1 || true
  else
    log "WebinoServer installer"
  fi
}

bootstrap_clone_valid() {
  [[ -f "$TARGET/install.sh" ]]
}

bootstrap_download_tarball() {
  local url tmpdir extract_dir archive downloaded=0 start_t=$SECONDS
  local -a archive_urls=(
    "${WEBINO_PACKAGE_BASE}/${WEBINO_REPO_SLUG}/archive/${REF}.tar.gz"
    "${WEBINO_PACKAGE_BASE}/api/v1/repos/${WEBINO_REPO_SLUG}/archive/${REF}.tar.gz"
  )

  tmpdir=$(mktemp -d)
  archive="$tmpdir/archive.tar.gz"
  log "Downloading WebinoServer (${REF})..."

  for url in "${archive_urls[@]}"; do
    if curl -fL \
      --connect-timeout "$WEBINO_CURL_CONNECT_TIMEOUT" \
      --max-time "$WEBINO_CURL_MAX_TIME" \
      --retry 1 --retry-delay 2 \
      -o "$archive" "$url" 2>/dev/null; then
      downloaded=1
      break
    fi
    rm -f "$archive"
  done

  [[ "$downloaded" -eq 1 && -s "$archive" ]] || { rm -rf "$tmpdir"; return 1; }

  tar -xzf "$archive" -C "$tmpdir" || { rm -rf "$tmpdir"; return 1; }
  extract_dir=$(find "$tmpdir" -mindepth 1 -maxdepth 1 -type d | head -1)
  [[ -n "$extract_dir" ]] || { rm -rf "$tmpdir"; return 1; }
  rm -rf "$TARGET"
  mv "$extract_dir" "$TARGET"
  rm -rf "$tmpdir"
  printf 'tarball\n' >"$TARGET/.webino-source"
  log "Download complete ($((SECONDS - start_t))s)"
  return 0
}

bootstrap_git_clone() {
  rm -rf "$TARGET"
  git "${GIT_HTTP_OPTS[@]}" clone --depth 1 --branch "$REF" "$REPO" "$TARGET"
}

bootstrap_acquire_server() {
  if [[ "$WEBINO_SKIP_UPDATE" == "1" ]] && bootstrap_clone_valid; then
    log "Skipping update (WEBINO_SKIP_UPDATE=1)"
    return 0
  fi

  if bootstrap_clone_valid; then
    if [[ -d "$TARGET/.git" ]]; then
      log "Syncing $TARGET..."
      git -C "$TARGET" fetch origin "$REF" && git -C "$TARGET" reset --hard "origin/$REF" || true
      bootstrap_clone_valid && return 0
    fi
  fi

  bootstrap_ensure_curl_tar || die "curl and tar required"
  if bootstrap_download_tarball; then
    return 0
  fi

  warn "Archive failed — trying git clone..."
  have git || { apt-get update -qq && apt-get install -y git 2>/dev/null || true; }
  have git || die "git required"
  bootstrap_git_clone
}

bootstrap_require_root "$@"

bootstrap_show_welcome
bootstrap_acquire_server
bootstrap_clone_valid || die "Bootstrap failed: $TARGET incomplete"

cd "$TARGET"
chmod +x install.sh bin/webina 2>/dev/null || true

INSTALL_ARGS=(--server --yes)
if bootstrap_has_flag --non-interactive "$@"; then
  INSTALL_ARGS+=(--non-interactive)
fi
if bootstrap_full_mode "$@"; then
  INSTALL_ARGS+=(--panel)
  log "Full stack install (platform + web panel)..."
elif [[ -t 0 ]] && [[ -e /dev/tty ]] && ! bootstrap_has_flag --non-interactive "$@"; then
  INSTALL_ARGS+=(--first-run)
  log "Starting server install and control panel..."
else
  INSTALL_ARGS+=(--non-interactive)
  log "Non-interactive bootstrap..."
fi

if [[ -t 0 ]] && [[ -e /dev/tty ]]; then
  exec ./install.sh "${INSTALL_ARGS[@]}" </dev/tty >/dev/tty 2>&1
else
  exec ./install.sh "${INSTALL_ARGS[@]}"
fi
