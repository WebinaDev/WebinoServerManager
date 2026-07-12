#!/usr/bin/env bash
# Webino multi-site platform paths and names.

WEBINA_DATA_ROOT="${WEBINA_DATA_ROOT:-${WEBINO_DATA_ROOT:-/var/lib/webina}}"
WEBINA_PLATFORM_DIR="${WEBINA_DATA_ROOT}/platform"
WEBINA_SITES_DIR="${WEBINA_DATA_ROOT}/sites"
WEBINA_IMAGES_DIR="${WEBINA_DATA_ROOT}/images"
WEBINA_PRODUCTS_DIR="${WEBINA_DATA_ROOT}/products"
WEBINA_REGISTRY_FILE="${WEBINA_DATA_ROOT}/registry.json"
WEBINA_NETWORK="webino_platform"
WEBINO_REDIS_CONTAINER="webino-redis"
WEBINO_CADDY_CONTAINER="webino-caddy"
WEBINO_DEFAULT_PRODUCT="${WEBINO_DEFAULT_PRODUCT:-Webino}"

WEBINO_PLATFORM_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/webina/platform-path"

platform_compose_file() {
  printf '%s/docker-compose.yml' "$WEBINA_PLATFORM_DIR"
}

site_dir() {
  printf '%s/%s' "$WEBINA_SITES_DIR" "$1"
}

site_compose_file() {
  printf '%s/docker-compose.yml' "$(site_dir "$1")"
}

site_project_name() {
  printf 'webino-%s' "$1"
}

site_backend_container() {
  printf '%s-backend' "$1"
}

site_next_container() {
  printf '%s-next' "$1"
}

validate_site_slug() {
  local slug="$1"
  [[ "$slug" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || return 1
}

ensure_platform_paths() {
  if [[ ! -d "$WEBINA_DATA_ROOT" ]]; then
    if have sudo; then
      sudo mkdir -p "$WEBINA_PLATFORM_DIR" "$WEBINA_SITES_DIR" "$WEBINA_IMAGES_DIR" "$WEBINA_PRODUCTS_DIR"
      sudo chown -R "$(id -u):$(id -g)" "$WEBINA_DATA_ROOT"
      sudo chmod -R u+rwX "$WEBINA_DATA_ROOT"
    else
      die "Platform data root missing: $WEBINA_DATA_ROOT (run with sudo or create manually)"
    fi
  fi
  mkdir -p "$WEBINA_PLATFORM_DIR" "$WEBINA_SITES_DIR" "$WEBINA_IMAGES_DIR" "$WEBINA_PRODUCTS_DIR" 2>/dev/null || {
    sudo mkdir -p "$WEBINA_PLATFORM_DIR" "$WEBINA_SITES_DIR" "$WEBINA_IMAGES_DIR" "$WEBINA_PRODUCTS_DIR"
    sudo chown -R "$(id -u):$(id -g)" "$WEBINA_DATA_ROOT"
  }
}

save_platform_config() {
  mkdir -p "$(dirname "$WEBINO_PLATFORM_CONFIG")"
  printf '%s\n' "$WEBINA_DATA_ROOT" >"$WEBINO_PLATFORM_CONFIG"
}

load_platform_config() {
  if [[ -f "$WEBINO_PLATFORM_CONFIG" ]]; then
    WEBINA_DATA_ROOT="$(tr -d '\n' <"$WEBINO_PLATFORM_CONFIG")"
    WEBINA_PLATFORM_DIR="${WEBINA_DATA_ROOT}/platform"
    WEBINA_SITES_DIR="${WEBINA_DATA_ROOT}/sites"
    WEBINA_IMAGES_DIR="${WEBINA_DATA_ROOT}/images"
    WEBINA_PRODUCTS_DIR="${WEBINA_DATA_ROOT}/products"
    WEBINA_REGISTRY_FILE="${WEBINA_DATA_ROOT}/registry.json"
  fi
}

platform_is_initialized() {
  [[ -f "$(platform_compose_file)" && -f "$WEBINA_REGISTRY_FILE" ]]
}

ensure_platform_network() {
  have docker || die "Docker required"
  if ! docker network inspect "$WEBINA_NETWORK" >/dev/null 2>&1; then
    log "Creating Docker network ${WEBINA_NETWORK}..."
    docker network create "$WEBINA_NETWORK" || die "Failed to create network ${WEBINA_NETWORK}"
  fi
}

platform_network_exists() {
  have docker || return 1
  docker network inspect "$WEBINA_NETWORK" >/dev/null 2>&1
}

platform_stack_running() {
  have docker || return 1
  docker ps --format '{{.Names}}' | grep -qx "$WEBINO_REDIS_CONTAINER" \
    && docker ps --format '{{.Names}}' | grep -qx "$WEBINO_CADDY_CONTAINER"
}

platform_is_healthy() {
  platform_is_initialized && platform_network_exists && platform_stack_running
}

is_first_run() {
  if ! platform_is_initialized; then
    return 0
  fi
  [[ "$(registry_count 2>/dev/null || echo 0)" == "0" ]]
}

site_product() {
  local slug="$1" product meta
  if registry_site_exists "$slug" 2>/dev/null; then
    product=$(registry_get_field "$slug" product 2>/dev/null || true)
    if [[ -n "$product" ]] && product_normalize "$product" >/dev/null 2>&1; then
      product_normalize "$product"
      return 0
    fi
  fi
  meta="$(site_dir "$slug")/site.meta.json"
  if [[ -f "$meta" ]]; then
    product=$(python3 - "$meta" <<'PY'
import json, sys
try:
    print(json.load(open(sys.argv[1])).get("product", ""))
except Exception:
    pass
PY
)
    if [[ -n "$product" ]] && product_normalize "$product" >/dev/null 2>&1; then
      product_normalize "$product"
      return 0
    fi
  fi
  printf '%s' "$WEBINO_DEFAULT_PRODUCT"
}

site_backend_image_for() {
  product_backend_image "$(site_product "$1")"
}

site_next_image_for() {
  product_next_image "$(site_product "$1")"
}
