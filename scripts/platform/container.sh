#!/usr/bin/env bash
# Per-site and platform container operations.

site_compose() {
  local slug="$1"
  shift
  local compose_file
  compose_file="$(site_compose_file "$slug")"
  [[ -f "$compose_file" ]] || die "Site compose file not found: $compose_file"
  webina_compose -f "$compose_file" -p "$(site_project_name "$slug")" "$@"
}

platform_compose() {
  local compose_file
  compose_file="$(platform_compose_file)"
  [[ -f "$compose_file" ]] || die "Platform not initialized"
  webina_compose -f "$compose_file" -p webino-platform "$@"
}

site_container_status() {
  local slug="$1"
  local compose_file
  compose_file="$(site_compose_file "$slug")"
  if [[ ! -f "$compose_file" ]]; then
    printf 'missing'
    return
  fi
  local running total
  running=$(webina_compose -f "$compose_file" -p "$(site_project_name "$slug")" ps --status running -q 2>/dev/null | wc -l | tr -d ' ')
  total=$(webina_compose -f "$compose_file" -p "$(site_project_name "$slug")" ps -q 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$total" -eq 0 ]]; then
    printf 'stopped'
  elif [[ "$running" -eq "$total" ]]; then
    printf 'running'
  else
    printf 'partial'
  fi
}

site_start() {
  local slug="$1"
  site_compose "$slug" up -d
  if registry_site_exists "$slug" 2>/dev/null; then
    registry_update_status "$slug" "running"
  fi
  log "Site '$slug' started"
}

site_stop() {
  local slug="$1"
  site_compose "$slug" stop
  registry_update_status "$slug" "stopped"
  log "Site '$slug' stopped"
}

site_restart() {
  local slug="$1"
  site_compose "$slug" restart
  registry_update_status "$slug" "running"
  log "Site '$slug' restarted"
}

site_update() {
  local slug="$1"
  site_compose "$slug" up -d --force-recreate --pull missing
  log "Site '$slug' updated from latest images"
}

container_action() {
  local slug="$1" service="$2" action="$3"
  case "$action" in
    start) site_compose "$slug" start "$service" ;;
    stop) site_compose "$slug" stop "$service" ;;
    restart) site_compose "$slug" restart "$service" ;;
    update) site_compose "$slug" up -d --force-recreate --no-deps "$service" ;;
    *) die "Unknown container action: $action" ;;
  esac
  log "Container ${slug}-${service}: $action"
}

container_logs() {
  local slug="$1" service="$2" tail_lines="${3:-100}"
  site_compose "$slug" logs --tail="$tail_lines" "$service" 2>&1
}

container_logs_follow() {
  local slug="$1" service="$2" tail_lines="${3:-100}"
  site_compose "$slug" logs --tail="$tail_lines" -f "$service" 2>&1
}

platform_logs() {
  local service="${1:-}" tail_lines="${2:-100}"
  if [[ -n "$service" ]]; then
    platform_compose logs --tail="$tail_lines" "$service" 2>&1
  else
    platform_compose logs --tail="$tail_lines" 2>&1
  fi
}

site_ps() {
  local slug="$1"
  site_compose "$slug" ps
}

site_status_report() {
  local slug="$1"
  local domain ssl_info status ps_out product channel
  registry_site_exists "$slug" || die "Site not found: $slug"
  domain=$(registry_get_field "$slug" domain)
  product=$(registry_get_field "$slug" product)
  channel=$(registry_get_field "$slug" channel)
  [[ -n "$product" ]] || product="$WEBINO_DEFAULT_PRODUCT"
  [[ -n "$channel" ]] || channel="Dev"
  ssl_info=$(caddy_ssl_status "$slug" 2>/dev/null || echo "unknown")
  status=$(site_container_status "$slug" 2>/dev/null || echo "unknown")
  ps_out=$(site_ps "$slug" 2>&1 || echo "Could not read container status")
  printf 'Site: %s\nProduct: %s (%s)\nURL: https://%s\nSSL: %s\nStatus: %s\n\nContainers:\n%s\n' \
    "$slug" "$product" "$channel" "$domain" "$ssl_info" "$status" "$ps_out"
}

platform_status() {
  echo "Webino Platform Status"
  echo "======================"
  echo "Data root: $WEBINA_DATA_ROOT"
  echo "Sites:     $(registry_count)"
  echo ""
  if platform_is_initialized; then
    if platform_network_exists; then
      echo "Network ${WEBINA_NETWORK}: present"
    else
      echo "Network ${WEBINA_NETWORK}: missing"
    fi
    if platform_stack_running; then
      echo "Stack:     running"
      platform_compose ps 2>/dev/null || true
    else
      echo "Stack:     stopped"
      echo "Fix: webina platform repair  or  webina → Platform Setup"
    fi
    local template="${ROOT}/scripts/platform/compose.platform.yml"
    local deployed
    deployed="$(platform_compose_file)"
    if [[ -f "$template" && -f "$deployed" ]] && ! cmp -s "$template" "$deployed" 2>/dev/null; then
      echo "Compose:   deployed file differs from template — run: webina platform repair"
    fi
  else
    echo "Platform not initialized. Run: webina platform init"
  fi
}

bootstrap_site_backend() {
  local slug="$1"
  local product
  product="$(site_product "$slug")"
  log "Bootstrapping backend for site '$slug' (product=${product})..."

  local bootstrap_cmd="if ! grep -q '^APP_KEY=base64:' /var/www/html/.env 2>/dev/null; then php artisan key:generate --force; fi \
    && php artisan migrate --force \
    && php artisan db:seed --force \
    && php artisan storage:link --force"

  if [[ "$product" == "Webino" ]]; then
    bootstrap_cmd="${bootstrap_cmd} && php artisan webino:provision-bootstrap --force"
  elif [[ "$product" == "WebinoERM" ]]; then
    local env_file
    env_file="$(site_dir "$slug")/backend/.env"
    if [[ -f "$env_file" ]] && grep -q '^MARKETING_IMPORT_WORDPRESS_URL=' "$env_file" 2>/dev/null; then
      local wp_url
      wp_url=$(grep '^MARKETING_IMPORT_WORDPRESS_URL=' "$env_file" | cut -d= -f2- | tr -d '"' | tr -d "'")
      if [[ -n "$wp_url" ]]; then
        bootstrap_cmd="${bootstrap_cmd} && php artisan marketing:import-wordpress --url=${wp_url}"
      fi
    fi
  fi

  bootstrap_cmd="${bootstrap_cmd} && php artisan config:cache && php artisan route:cache"

  site_compose "$slug" run --rm --no-deps backend sh -c "$bootstrap_cmd"
}
