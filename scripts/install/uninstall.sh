#!/usr/bin/env bash
# WebinoServer uninstall helpers.

UNINSTALL_STOP_DOCKER="${UNINSTALL_STOP_DOCKER:-true}"
UNINSTALL_REMOVE_VOLUMES="${UNINSTALL_REMOVE_VOLUMES:-false}"
UNINSTALL_REMOVE_IMAGES="${UNINSTALL_REMOVE_IMAGES:-false}"
UNINSTALL_REMOVE_CLI="${UNINSTALL_REMOVE_CLI:-false}"

platform_stack_down() {
  have docker || return 0
  # shellcheck source=scripts/platform/load.sh
  source "${ROOT}/scripts/platform/load.sh"
  load_platform_libs
  if platform_is_initialized; then
    if [[ "$UNINSTALL_REMOVE_VOLUMES" == true ]]; then
      platform_compose down -v 2>/dev/null || true
    else
      platform_compose down 2>/dev/null || true
    fi
    log "Platform stack stopped."
  fi
}

docker_remove_product_images() {
  have docker || return 0
  local product img
  for product in Webino WebinoERM; do
    for img in "$(product_backend_image "$product" 2>/dev/null)" "$(product_next_image "$product" 2>/dev/null)"; do
      [[ -n "$img" ]] || continue
      docker rmi -f "$img" 2>/dev/null || true
    done
  done
  log "Product Docker images removed (best effort)."
}

run_uninstall() {
  log "Starting WebinoServer uninstall..."

  if [[ "$UNINSTALL_STOP_DOCKER" == true ]]; then
    log "Stopping panel stack..."
    if [[ -f "${ROOT}/panel/docker-compose.panel.yml" ]]; then
      # shellcheck source=scripts/install/panel.sh
      source "${ROOT}/scripts/install/panel.sh"
      panel_down || true
    fi
    log "Stopping platform stack..."
    platform_stack_down
  fi

  if [[ "$UNINSTALL_REMOVE_IMAGES" == true ]]; then
    # shellcheck source=scripts/products/load.sh
    source "${ROOT}/scripts/products/load.sh"
    load_products_libs
    docker_remove_product_images
  fi

  if [[ "$UNINSTALL_REMOVE_CLI" == true ]]; then
    unregister_webina_cli
  fi

  log "Uninstall completed."
}

uninstall_summary() {
  cat <<EOF
Uninstall options applied:
  Stop platform stack:   $UNINSTALL_STOP_DOCKER
  Remove Docker volumes: $UNINSTALL_REMOVE_VOLUMES
  Remove product images: $UNINSTALL_REMOVE_IMAGES
  Remove webina CLI:     $UNINSTALL_REMOVE_CLI
EOF
}
