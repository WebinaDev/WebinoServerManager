#!/usr/bin/env bash
# Shared panel secret generation for install.sh and CI scripts.

panel_rand_hex() {
  local nbytes="${1:-16}"
  openssl rand -hex "$nbytes" 2>/dev/null || head -c "$nbytes" /dev/urandom | xxd -p
}

panel_detect_ip() {
  local ip=""
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [[ -z "$ip" ]]; then
    ip=$(curl -sf --max-time 3 ifconfig.me 2>/dev/null || echo "localhost")
  fi
  echo "$ip"
}

panel_validate_token_sync() {
  local panel_env="$1" backend_env="$2"
  local panel_token backend_token
  panel_token=$(read_env "${panel_env}" "WEBINO_AGENT_TOKEN" "")
  backend_token=$(read_env "${backend_env}" "WEBINO_AGENT_TOKEN" "")

  if [[ -n "$panel_token" && -n "$backend_token" && "$panel_token" != "$backend_token" ]]; then
    die "WEBINO_AGENT_TOKEN mismatch between panel/.env and panel/backend/.env.

Copy the same token to both files, then recreate services:
  docker compose --env-file panel/.env -f panel/docker-compose.panel.yml up -d --force-recreate \\
    backend agent phpmyadmin phppgadmin roundcube

See panel/docs/AGENT_SECURITY.md"
  fi
}

panel_configure_urls() {
  local backend_env="$1"
  local ip port base_url domains cors
  ip=$(panel_detect_ip)
  port="${PANEL_HTTP_PORT:-2090}"
  base_url="http://${ip}:${port}"
  domains="${ip},${ip}:${port},localhost,localhost:${port},127.0.0.1,127.0.0.1:${port}"
  cors="http://${ip}:${port},http://127.0.0.1:${port},http://localhost:${port}"

  patch_env "${backend_env}" "APP_URL" "$base_url"
  patch_env "${backend_env}" "FRONTEND_URL" "$base_url"
  patch_env "${backend_env}" "SANCTUM_STATEFUL_DOMAINS" "$domains"
  patch_env "${backend_env}" "CORS_ALLOWED_ORIGINS" "$cors"
  patch_env "${backend_env}" "SESSION_SECURE_COOKIE" "false"
  patch_env "${backend_env}" "AUTH_COOKIE_SECURE" "false"
}

# generate_panel_secrets PANEL_DIR [ci_mode]
# Ensures panel/.env and panel/backend/.env exist with synced secrets.
generate_panel_secrets() {
  local panel_dir="$1"
  local ci_mode="${2:-0}"
  local panel_env="${panel_dir}/.env"
  local backend_env="${panel_dir}/backend/.env"
  local db_pass db_root_pass agent_token roundcube_key

  if [[ ! -f "${backend_env}" && -f "${panel_dir}/backend/.env.example" ]]; then
    cp "${panel_dir}/backend/.env.example" "${backend_env}"
    log "Created panel/backend/.env from example"
  fi

  db_pass=$(read_env "${backend_env}" "DB_PASSWORD" "")
  if [[ -z "$db_pass" || "$db_pass" == "webinoserver" ]]; then
    db_pass=$(panel_rand_hex 16)
    patch_env "${backend_env}" "DB_PASSWORD" "$db_pass"
    log "Generated DB_PASSWORD"
  fi

  agent_token=$(read_env "${backend_env}" "WEBINO_AGENT_TOKEN" "")
  if [[ -z "$agent_token" ]]; then
    agent_token=$(panel_rand_hex 32)
    patch_env "${backend_env}" "WEBINO_AGENT_TOKEN" "$agent_token"
    log "Generated WEBINO_AGENT_TOKEN"
  fi

  if [[ ! -f "${panel_env}" ]]; then
    if [[ -f "${panel_dir}/.env.example" ]]; then
      cp "${panel_dir}/.env.example" "${panel_env}"
      log "Created panel/.env from example"
    else
      touch "${panel_env}"
    fi
  fi

  db_root_pass=$(read_env "${panel_env}" "PANEL_DB_ROOT_PASSWORD" "")
  if [[ -z "$db_root_pass" || "$db_root_pass" == "root" ]]; then
    db_root_pass=$(panel_rand_hex 16)
    log "Generated PANEL_DB_ROOT_PASSWORD"
  fi

  roundcube_key=$(read_env "${panel_env}" "ROUNDCUBE_DES_KEY" "")
  if [[ -z "$roundcube_key" || "$roundcube_key" == "roundcube-des-key" ]]; then
    roundcube_key=$(panel_rand_hex 24)
    log "Generated ROUNDCUBE_DES_KEY"
  fi

  patch_env "${panel_env}" "PANEL_DB_PASSWORD" "$db_pass"
  patch_env "${panel_env}" "PANEL_DB_ROOT_PASSWORD" "$db_root_pass"
  patch_env "${panel_env}" "WEBINO_AGENT_TOKEN" "$agent_token"
  patch_env "${panel_env}" "ROUNDCUBE_DES_KEY" "$roundcube_key"

  if [[ "$ci_mode" == "1" ]]; then
    patch_env "${backend_env}" "APP_ENV" "local"
    patch_env "${backend_env}" "APP_DEBUG" "true"
  fi

  # Compose service DNS names (not legacy panel-db / panel-redis aliases)
  patch_env "${backend_env}" "DB_HOST" "db"
  patch_env "${backend_env}" "REDIS_HOST" "redis"

  panel_validate_token_sync "${panel_env}" "${backend_env}"
  panel_configure_urls "${backend_env}"

  chmod 600 "${panel_env}" "${backend_env}" 2>/dev/null || true

  if [[ -z "$agent_token" ]]; then
    die "WEBINO_AGENT_TOKEN is empty — cannot start panel stack"
  fi
}

wait_for_panel_api() {
  local port="${PANEL_HTTP_PORT:-2090}"
  local compose_file="${1:-}"
  local panel_env="${2:-}"
  local max="${3:-120}"
  local i

  panel_api_direct_ready() {
    [[ -n "$compose_file" && -n "$panel_env" ]] && have docker || return 1
    webina_compose -f "$compose_file" --env-file "$panel_env" exec -T backend \
      curl -sf --max-time 5 http://127.0.0.1:8080/up >/dev/null 2>&1
  }

  panel_setup_status_ready() {
    if curl -sf --max-time 5 "http://127.0.0.1:${port}/api/v1/setup/status" >/dev/null 2>&1; then
      return 0
    fi
    [[ -n "$compose_file" && -n "$panel_env" ]] && have docker || return 1
    webina_compose -f "$compose_file" --env-file "$panel_env" exec -T backend \
      curl -sf --max-time 5 http://127.0.0.1:8080/v1/setup/status >/dev/null 2>&1
  }

  log "Waiting for panel API (up to $((max * 5))s)..."
  for ((i = 1; i <= max; i++)); do
    if panel_api_direct_ready || panel_setup_status_ready; then
      log "Panel API reachable after ${i} attempt(s)"
      return 0
    fi
    if [[ $((i % 12)) -eq 0 ]]; then
      log "Still waiting for panel API (${i}/${max})..."
    fi
    if [[ $i -eq "$max" ]]; then
      warn "Panel API not reachable after ${max} attempts"
      if [[ -n "$compose_file" && -n "$panel_env" ]] && have docker; then
        webina_compose -f "$compose_file" --env-file "$panel_env" ps 2>/dev/null || true
        webina_compose -f "$compose_file" --env-file "$panel_env" logs backend frontend --tail=80 2>/dev/null || true
      fi
      return 1
    fi
    sleep 5
  done
}
