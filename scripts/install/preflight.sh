#!/usr/bin/env bash
# Prerequisite checks for WebinoServer installer.

PREFLIGHT_ISSUES=()
PREFLIGHT_FIXES=()

preflight_add_issue() {
  local issue="$1"
  local fix="${2:-}"
  PREFLIGHT_ISSUES+=("$issue")
  PREFLIGHT_FIXES+=("$fix")
}

preflight_print_issues() {
  warn "Preflight found ${#PREFLIGHT_ISSUES[@]} issue(s):"
  local i issue fix
  for i in "${!PREFLIGHT_ISSUES[@]}"; do
    issue="${PREFLIGHT_ISSUES[$i]}"
    fix="${PREFLIGHT_FIXES[$i]}"
    warn "  - $issue"
    if [[ -n "$fix" ]]; then
      warn "    Fix: $fix"
    fi
  done
}

preflight_check_root() {
  [[ "${PREFLIGHT_SKIP_ROOT:-0}" == "1" ]] && return 0
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    return 0
  fi
  if have sudo && sudo -n true 2>/dev/null; then
    return 0
  fi
  preflight_add_issue \
    "Root or passwordless sudo required for server bootstrap" \
    "Run: sudo ./install.sh --server --yes"
}

preflight_check_disk() {
  local avail_kb min_kb=2097152
  if [[ "${SERVER_MODE:-false}" == true && "${PANEL_MODE:-false}" == true ]]; then
    min_kb=9437184
  elif [[ "${PANEL_MODE:-false}" == true ]]; then
    min_kb=8388608
  fi

  avail_kb=$(df -k "${WEBINA_DATA_ROOT:-$ROOT}" 2>/dev/null | awk 'NR==2 {print $4}')
  if [[ -z "$avail_kb" ]]; then
    avail_kb=$(df -k "$ROOT" 2>/dev/null | awk 'NR==2 {print $4}')
  fi
  if [[ -n "$avail_kb" && "$avail_kb" -lt "$min_kb" ]]; then
    local min_gb=$((min_kb / 1024 / 1024))
    preflight_add_issue \
      "Low disk space: less than ${min_gb} GB free" \
      "Free disk space or expand volume (panel Docker builds need ${min_gb} GB+)"
  fi
}

preflight_check_docker() {
  local required=false
  if [[ "${SERVER_MODE:-false}" == true || "${PANEL_MODE:-false}" == true ]]; then
    required=true
  fi
  [[ "$required" == true ]] || return 0

  if ! have docker; then
    preflight_add_issue \
      "Docker is required but not installed" \
      "curl -fsSL https://get.docker.com | sh && systemctl enable --now docker"
    return
  fi

  if ! webina_compose_available; then
    preflight_add_issue \
      "Docker Compose is required but not installed" \
      "apt install -y docker-compose-plugin   or   curl -fsSL https://get.docker.com | sh"
    return
  fi

  if ! webina_compose_verify; then
    preflight_add_issue \
      "Docker Compose is installed but not working" \
      "apt install -y docker-compose-plugin   or   curl -fsSL https://get.docker.com | sh"
    return
  fi

  if ! docker info >/dev/null 2>&1; then
    preflight_add_issue \
      "Docker daemon is not running" \
      "systemctl start docker   or   service docker start"
  fi
}

preflight_check_panel_port() {
  [[ "${PANEL_MODE:-false}" == true ]] || return 0
  local port="${PANEL_HTTP_PORT:-2090}"
  if have ss; then
    if ss -tlnp 2>/dev/null | grep -qE ":${port}\s"; then
      if have docker && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'webinoserver-panel-web'; then
        return 0
      fi
      preflight_add_issue \
        "Port ${port} is already in use (panel HTTP)" \
        "Stop the conflicting service or set PANEL_HTTP_PORT to another port"
    fi
  fi
}

preflight_check_python3() {
  [[ "${SERVER_MODE:-false}" == true ]] || return 0
  have python3 || preflight_add_issue \
    "python3 is required for site registry" \
    "apt install -y python3"
}

preflight_check_envsubst() {
  [[ "${SERVER_MODE:-false}" == true ]] || return 0
  have envsubst || preflight_add_issue \
    "envsubst is required for site compose generation" \
    "apt install -y gettext-base"
}

preflight_check_docker_build_network() {
  [[ "${SERVER_MODE:-false}" == true || "${PANEL_MODE:-false}" == true ]] || return 0
  have docker || return 0
  docker info >/dev/null 2>&1 || return 0

  if docker run --rm --network bridge alpine:3.19 wget -q -O /dev/null -T 10 http://deb.debian.org 2>/dev/null; then
    return 0
  fi

  warn "Docker build network check failed — product image builds may fail during apt-get update."
  warn "Fix: WEBINA_DOCKER_BUILD_NETWORK=host webina product install Webino"
  warn "Fix: WEBINA_DOCKER_BUILD_RETRY_HOST=1 webina product install Webino"
}

preflight_check_docker_hub() {
  [[ "${SERVER_MODE:-false}" == true || "${PANEL_MODE:-false}" == true ]] || return 0
  local hub_status=0
  docker_registry_test_hub || hub_status=$?
  case "$hub_status" in
    0) return 0 ;;
    2)
      warn "Docker Hub returned 403 — panel/platform image pulls may fail until mirror is configured."
      warn "Fix: re-run ./install.sh --panel (auto-configures mirror.gcr.io on pull failure)"
      ;;
    *)
      warn "Could not reach Docker Hub — image pulls may fail; installer will try registry mirror."
      ;;
  esac
}

run_preflight_server() {
  SERVER_MODE=true
  PREFLIGHT_ISSUES=()
  PREFLIGHT_FIXES=()
  # shellcheck source=scripts/install/docker-registry.sh
  source "${ROOT}/scripts/install/docker-registry.sh"
  preflight_check_root
  preflight_check_disk
  preflight_check_docker
  preflight_check_python3
  preflight_check_envsubst
  preflight_check_docker_build_network
  preflight_check_docker_hub

  if [[ ${#PREFLIGHT_ISSUES[@]} -gt 0 ]]; then
    preflight_print_issues
    return 1
  fi
  log "Server preflight checks passed."
  return 0
}

run_preflight_panel() {
  PANEL_MODE=true
  PREFLIGHT_ISSUES=()
  PREFLIGHT_FIXES=()
  # shellcheck source=scripts/install/docker-registry.sh
  source "${ROOT}/scripts/install/docker-registry.sh"
  preflight_check_disk
  preflight_check_docker
  preflight_check_panel_port
  preflight_check_docker_hub

  if [[ ${#PREFLIGHT_ISSUES[@]} -gt 0 ]]; then
    preflight_print_issues
    return 1
  fi
  log "Panel preflight checks passed."
  return 0
}

preflight_report() {
  PREFLIGHT_ISSUES=()
  PREFLIGHT_FIXES=()
  preflight_check_disk
  preflight_check_docker
  preflight_check_python3
  preflight_check_envsubst
  preflight_check_docker_build_network

  echo "WebinoServer System Check"
  echo "============================"
  echo ""
  echo "Project root: $ROOT"
  echo ""
  echo "Tools:"
  echo "  docker:    $(have docker && echo yes || echo no)"
  echo "  daemon:    $(have docker && docker info >/dev/null 2>&1 && echo running || echo not running)"
  echo "  compose:   $(if webina_compose_available; then echo yes; else echo no; fi)"
  echo "  python3:   $(have python3 && python3 --version 2>&1 | head -1 || echo not found)"
  echo "  envsubst:  $(have envsubst && echo yes || echo not found)"
  echo "  dialog:    $(have dialog && dialog --version 2>&1 | head -1 || echo not found)"
  echo "  webina:    $(command -v webina >/dev/null 2>&1 && command -v webina || echo not installed)"
  if declare -f platform_is_initialized >/dev/null 2>&1; then
    echo "  platform:  $(platform_is_initialized && echo initialized || echo not initialized)"
  else
    echo "  platform:  $( [[ -f /var/lib/webina/registry.json ]] && echo initialized || echo not initialized )"
  fi
  echo ""
  if [[ ${#PREFLIGHT_ISSUES[@]} -eq 0 ]]; then
    echo "Status: All checks passed."
  else
    echo "Issues:"
    local i
    for i in "${!PREFLIGHT_ISSUES[@]}"; do
      echo "  - ${PREFLIGHT_ISSUES[$i]}"
      [[ -n "${PREFLIGHT_FIXES[$i]:-}" ]] && echo "    Fix: ${PREFLIGHT_FIXES[$i]}"
    done
  fi
}

ensure_dialog() {
  have dialog && return 0
  warn "GNU dialog not found; attempting to install..."

  if have apt-get; then
    apt-get update -qq && apt-get install -y dialog && return 0
  elif have dnf; then
    dnf install -y dialog && return 0
  elif have yum; then
    yum install -y dialog && return 0
  elif have pacman; then
    pacman -Sy --noconfirm dialog && return 0
  elif have brew; then
    brew install dialog && return 0
  fi

  return 1
}
