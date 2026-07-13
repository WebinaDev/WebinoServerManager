#!/usr/bin/env bash
# WebinoServer installer — platform bootstrap and control panel entry point.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# shellcheck source=scripts/install/common.sh
source "${ROOT}/scripts/install/common.sh"

SERVER_MODE=false
PANEL_MODE=false
FIRST_RUN=false
FORCE_TUI=false
NON_INTERACTIVE=false
YES=false
UNINSTALL=false
CLI_ARGS=()

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

WebinoServer manages the multi-site platform (Caddy + Redis) and products
(Webino, WebinoERM). Run without options in an interactive terminal to open
the control panel. After install, run `webina` from anywhere.

Options:
  --server             Bootstrap platform (Docker, Caddy, Redis, webina CLI)
  --panel              Start hosting panel stack (Laravel + Next.js + agent)
  --first-run          Open platform TUI after server bootstrap (not with --panel)
  --uninstall          Remove platform CLI registration and optional data
  --yes, -y            Skip confirmation prompts
  --non-interactive    Force headless mode
  --tui                Force interactive control panel
  -h, --help           Show this help

Examples:
  bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh) --full
  bash <(curl -fsSL https://raw.githubusercontent.com/WebinaDev/WebinoServerManager/main/bootstrap.sh)
  ./install.sh --server --yes
  ./install.sh --panel
  ./install.sh --server --panel --yes
  ./install.sh --server --yes --first-run
  webina
  webina product install Webino
  webina site create --slug shop1 --domain shop1.example.com --product Webino
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER_MODE=true; CLI_ARGS+=("$1") ;;
    --panel) PANEL_MODE=true; CLI_ARGS+=("$1") ;;
    --first-run) FIRST_RUN=true; FORCE_TUI=true; CLI_ARGS+=("$1") ;;
    --uninstall) UNINSTALL=true; CLI_ARGS+=("$1") ;;
    --yes|-y) YES=true; CLI_ARGS+=("$1") ;;
    --non-interactive) NON_INTERACTIVE=true; CLI_ARGS+=("$1") ;;
    --tui) FORCE_TUI=true; CLI_ARGS+=("$1") ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1 (use --help)" ;;
  esac
  shift
done

source "${ROOT}/scripts/install/preflight.sh"
source "${ROOT}/scripts/install/cli.sh"
source "${ROOT}/scripts/install/uninstall.sh"

attach_tty_if_needed() {
  [[ -e /dev/tty ]] || return 0
  { exec </dev/tty >/dev/tty 2>&1; } 2>/dev/null || true
}

should_run_tui() {
  [[ "$UNINSTALL" == true ]] && return 1
  [[ "$SERVER_MODE" == true ]] && return 1
  [[ "$FORCE_TUI" == true ]] && return 0
  [[ "$NON_INTERACTIVE" == true ]] && return 1
  [[ ${#CLI_ARGS[@]} -gt 0 ]] && return 1
  [[ -t 0 && -t 1 ]] || return 1
  [[ "${TERM:-dumb}" != "dumb" ]] || return 1
  return 0
}

run_headless_uninstall() {
  UNINSTALL_STOP_DOCKER=true
  UNINSTALL_REMOVE_VOLUMES=false
  UNINSTALL_REMOVE_IMAGES=false
  UNINSTALL_REMOVE_DEPS=false
  UNINSTALL_REMOVE_ENV=false
  UNINSTALL_REMOVE_DB=false
  UNINSTALL_REMOVE_CLI=true

  if [[ "$YES" == false && -t 0 ]]; then
    read -r -p "Proceed with uninstall (stop platform stack, remove CLI)? [y/N]: " ans
    [[ "$ans" =~ ^[Yy] ]] || { log "Aborted."; exit 0; }
  fi

  run_uninstall
}

if [[ "$UNINSTALL" == true ]]; then
  run_headless_uninstall
else
  if [[ "$SERVER_MODE" == true ]]; then
    export PANEL_MODE FIRST_RUN NON_INTERACTIVE
    # shellcheck source=scripts/install/server-bootstrap.sh
    source "${ROOT}/scripts/install/server-bootstrap.sh"
    run_server_bootstrap
  fi

  if [[ "$PANEL_MODE" == true ]]; then
    # shellcheck source=scripts/install/deps.sh
    source "${ROOT}/scripts/install/deps.sh"
    if [[ "$SERVER_MODE" != true ]]; then
      log "Checking system dependencies for panel..."
      ensure_system_deps
    fi
    run_preflight_panel || die "Panel preflight failed"
    # shellcheck source=scripts/install/panel.sh
    source "${ROOT}/scripts/install/panel.sh"
    panel_up
    if [[ "$FIRST_RUN" == true && -e /dev/tty ]] && [[ "$NON_INTERACTIVE" != true ]]; then
      attach_tty_if_needed
      export FIRST_RUN
      # shellcheck source=scripts/tui.sh
      source "${ROOT}/scripts/tui.sh"
      run_tui
    fi
  elif [[ "$SERVER_MODE" == true && "$FIRST_RUN" == true ]]; then
    attach_tty_if_needed
    export FIRST_RUN
    # shellcheck source=scripts/tui.sh
    source "${ROOT}/scripts/tui.sh"
    run_tui
  elif [[ "$SERVER_MODE" != true ]]; then
    if should_run_tui; then
      attach_tty_if_needed
      # shellcheck source=scripts/tui.sh
      source "${ROOT}/scripts/tui.sh"
      run_tui
    else
      log "WebinoServer — run ./install.sh --server --yes or open control panel with: webina"
      usage
    fi
  fi
fi
