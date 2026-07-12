#!/usr/bin/env bash
# Shared helpers for WebinoServer installer.

log() { printf '\033[1;34m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[install]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[install]\033[0m %s\n' "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

webina_compose_v2_works() {
  have docker && docker compose version >/dev/null 2>&1
}

webina_compose_legacy_works() {
  have docker-compose && docker-compose version >/dev/null 2>&1
}

webina_compose_verify() {
  if webina_compose_v2_works; then
    return 0
  fi
  if webina_compose_legacy_works; then
    return 0
  fi
  return 1
}

webina_compose_available() {
  webina_compose_verify
}

webina_compose_diagnose() {
  warn "Docker Compose diagnostics:"
  if have docker; then
    warn "  docker: $(docker --version 2>&1 || echo 'version failed')"
    warn "  docker compose: $(docker compose version 2>&1 || echo 'not available')"
  else
    warn "  docker: not found"
  fi
  if have docker-compose; then
    warn "  docker-compose path: $(command -v docker-compose)"
    warn "  docker-compose: $(docker-compose version 2>&1 || echo 'broken or incompatible')"
  else
    warn "  docker-compose: not found"
  fi
  local plugin_dir
  for plugin_dir in /usr/libexec/docker/cli-plugins /usr/local/lib/docker/cli-plugins; do
    if [[ -d "$plugin_dir" ]]; then
      warn "  plugins in ${plugin_dir}: $(ls -1 "$plugin_dir" 2>/dev/null | tr '\n' ' ' || echo 'empty')"
    fi
  done
  if have docker-compose && ! webina_compose_v2_works && ! webina_compose_legacy_works; then
    warn "  note: docker-compose binary exists but does not work — install docker-compose-plugin or Compose v2 plugin binary"
  elif have docker-compose && ! webina_compose_v2_works && webina_compose_legacy_works; then
    warn "  note: only legacy docker-compose v1 works — v2 plugin recommended for panel/platform stacks"
  fi
}

webina_compose() {
  if webina_compose_v2_works; then
    docker compose "$@"
  elif webina_compose_legacy_works; then
    docker-compose "$@"
  else
    webina_compose_diagnose
    die "Docker Compose is not installed.
  Fix: apt install -y docker-compose-plugin
  Fix: curl -fsSL https://get.docker.com | sh && systemctl enable --now docker"
  fi
}

patch_env() {
  local file="$1" key="$2" value="$3"
  if [[ ! -f "$file" ]]; then
    die "Missing env file: $file"
  fi
  local esc
  esc=$(printf '%s' "$value" | sed -e 's/[&|\\]/\\&/g')
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${esc}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$file"
  fi
}

read_env() {
  local file="$1" key="$2" default="${3:-}"
  if [[ -f "$file" ]] && grep -q "^${key}=" "$file"; then
    grep "^${key}=" "$file" | head -1 | cut -d= -f2-
  else
    printf '%s' "$default"
  fi
}
