#!/usr/bin/env bash
# Initialize Webino multi-site platform on the server.

platform_check_ports() {
  local port line
  for port in 80 443; do
    if have ss; then
      line=$(ss -tlnp 2>/dev/null | grep -E ":${port}\s" | head -1 || true)
      if [[ -n "$line" ]]; then
        die "Port ${port} is already in use. Caddy needs ports 80 and 443.
  In use: ${line}
  Fix: systemctl stop nginx
  Fix: systemctl stop apache2
  Fix: identify process with: ss -tlnp | grep :${port}"
      fi
    fi
  done
}

platform_prepull_images() {
  # shellcheck source=scripts/install/docker-registry.sh
  source "${ROOT}/scripts/install/docker-registry.sh"
  platform_compose_prepull || warn "Platform image pre-pull had issues — compose up will retry pulls"
}

init_platform() {
  load_platform_config
  log "Initializing Webino platform at $WEBINA_DATA_ROOT..."

  ensure_platform_paths

  # Platform stack only — product images are built on demand via webina product install.
  local platform_compose_src="${ROOT}/scripts/platform/compose.platform.yml"
  local caddy_template="${ROOT}/scripts/platform/Caddyfile.template"

  cp "$platform_compose_src" "$(platform_compose_file)"
  cp "$caddy_template" "${WEBINA_PLATFORM_DIR}/Caddyfile"
  mkdir -p "${WEBINA_PLATFORM_DIR}/caddy-data" "${WEBINA_PLATFORM_DIR}/caddy-config"

  registry_init
  save_platform_config

  platform_check_ports

  ensure_platform_network

  platform_prepull_images

  log "Starting platform stack (Caddy + Redis)..."
  if ! platform_compose up -d; then
    die "Platform stack failed to start.
  Fix: check Docker logs: docker compose -f $(platform_compose_file) -p webino-platform logs
  Fix: ensure ports 80/443 are free"
  fi

  if ! caddy_sync; then
    warn "Caddy config sync had issues — platform may still be starting"
    platform_compose up -d caddy 2>/dev/null || true
    caddy_reload 2>/dev/null || warn "Caddy reload pending — check: webina platform logs"
  fi

  log "Platform initialized."
  log "Data root: $WEBINA_DATA_ROOT"
}

platform_ensure_ready() {
  platform_is_initialized || die "Platform not initialized. Run: webina platform init"
  ensure_platform_network
  if ! platform_stack_running; then
    log "Platform stack not running — starting Caddy + Redis..."
    platform_prepull_images
    platform_compose up -d || die "Failed to start platform stack"
    caddy_sync || warn "Caddy sync pending — check: webina platform logs"
  fi
}

platform_repair() {
  load_platform_config
  platform_is_initialized || die "Platform not initialized. Run: webina platform init"
  log "Repairing platform stack..."

  ensure_platform_paths

  local platform_compose_src="${ROOT}/scripts/platform/compose.platform.yml"
  local caddy_template="${ROOT}/scripts/platform/Caddyfile.template"

  cp "$platform_compose_src" "$(platform_compose_file)"
  if [[ ! -f "${WEBINA_PLATFORM_DIR}/Caddyfile" ]]; then
    cp "$caddy_template" "${WEBINA_PLATFORM_DIR}/Caddyfile"
  fi
  mkdir -p "${WEBINA_PLATFORM_DIR}/caddy-data" "${WEBINA_PLATFORM_DIR}/caddy-config"

  ensure_platform_network

  platform_prepull_images

  log "Starting platform stack (Caddy + Redis)..."
  if ! platform_compose up -d; then
    die "Platform repair failed.
  Fix: check Docker logs: docker compose -f $(platform_compose_file) -p webino-platform logs"
  fi

  if ! caddy_sync; then
    warn "Caddy config sync had issues — platform may still be starting"
    platform_compose up -d caddy 2>/dev/null || true
    caddy_reload 2>/dev/null || warn "Caddy reload pending — check: webina platform logs"
  fi

  log "Platform repair complete."
}

platform_stack_restart() {
  platform_is_initialized || die "Platform not initialized"
  ensure_platform_network
  log "Restarting platform stack (Caddy + Redis)..."
  if ! platform_compose restart 2>/dev/null; then
    platform_compose up -d || die "Failed to restart platform stack"
  fi
  caddy_sync || warn "Caddy sync pending — check: webina platform logs"
  log "Platform stack restarted."
}
