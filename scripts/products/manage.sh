#!/usr/bin/env bash
# Product install, update, rebuild, and readiness checks.

product_images_exist() {
  local product="$1"
  product_require_valid "$product"
  have docker || return 1
  docker image inspect "$(product_backend_image "$product")" >/dev/null 2>&1 \
    && docker image inspect "$(product_next_image "$product")" >/dev/null 2>&1
}

build_product_images() {
  local product="$1" channel="${2:-}" src backend_df next_df
  product_require_valid "$product"
  have docker || die "Docker required to build product images"

  if [[ -z "$channel" ]]; then
    channel=$(product_installed_channel "$product")
  fi

  acquire_product "$product" "$channel"

  src=$(product_source_dir "$product")
  _acquire_install_valid "$src" || die "Product source missing for ${product}: ${src}"

  backend_df=$(product_backend_dockerfile "$src") || die "Missing docker/php/Dockerfile.platform in ${product} source"
  next_df=$(product_next_dockerfile "$src") || die "Missing docker/next/Dockerfile in ${product} source"

  log "Building images for ${product} (source: ${src})..."

  if ! product_docker_build "$backend_df" "$(product_backend_image "$product")" "$src"; then
    die "Backend image build failed for ${product}"
  fi

  if ! product_docker_build "$next_df" "$(product_next_image "$product")" "$src"; then
    die "Frontend image build failed for ${product}"
  fi

  log "Built $(product_backend_image "$product") and $(product_next_image "$product")"
}

rebuild_product_images() {
  build_product_images "$@"
}

product_ensure_images() {
  local product="$1" channel="${2:-}"
  product_images_exist "$product" && return 0
  warn "Images missing for ${product} — building..."
  build_product_images "$product" "$channel"
}

ensure_product_ready() {
  local product="$1" channel="${2:-Dev}"
  product_require_valid "$product"
  acquire_product "$product" "$channel"
  product_ensure_images "$product" "$channel"
}

product_install() {
  local product="$1" channel="${2:-Dev}"
  ensure_product_ready "$product" "$channel"
  log "Product ${product} installed (${channel})"
}

product_update() {
  local product="$1" channel="${2:-}"
  product_require_valid "$product"
  [[ -n "$channel" ]] || channel=$(product_installed_channel "$product")
  acquire_product "$product" "$channel"
  if [[ "${WEBINA_REBUILD_ON_UPDATE:-0}" == "1" ]]; then
    build_product_images "$product" "$channel"
  fi
  log "Product ${product} source updated (${channel})"
}

product_status_report() {
  local product="$1" src channel
  product_require_valid "$product"
  src=$(product_source_dir "$product")
  channel=$(product_installed_channel "$product")
  printf 'Product: %s\n' "$product"
  printf 'Source:  %s\n' "$src"
  printf 'Channel: %s\n' "$channel"
  if product_source_ready "$product"; then
    printf 'Source:  ready\n'
  else
    printf 'Source:  not installed\n'
  fi
  if product_images_exist "$product"; then
    printf 'Images:  %s, %s\n' "$(product_backend_image "$product")" "$(product_next_image "$product")"
  else
    printf 'Images:  not built\n'
  fi
}

list_products_status() {
  local product
  for product in "${WEBINO_SUPPORTED_PRODUCTS[@]}"; do
    local src_status img_status
    if product_source_ready "$product"; then
      src_status="installed"
    else
      src_status="missing"
    fi
    if product_images_exist "$product"; then
      img_status="built"
    else
      img_status="not built"
    fi
    printf '  %-12s source=%-10s images=%s\n' "$product" "$src_status" "$img_status"
  done
}

build_all_installed_product_images() {
  local product built=0
  for product in "${WEBINO_SUPPORTED_PRODUCTS[@]}"; do
    if product_source_ready "$product"; then
      build_product_images "$product" || return 1
      built=1
    fi
  done
  if [[ "$built" -eq 0 ]]; then
    warn "No product sources installed — install a product first (webina product install Webino)"
  fi
}

rebuild_platform_images() {
  build_all_installed_product_images
}

platform_images_exist() {
  local product
  for product in "${WEBINO_SUPPORTED_PRODUCTS[@]}"; do
    if product_source_ready "$product" && ! product_images_exist "$product"; then
      return 1
    fi
  done
  return 0
}

platform_ensure_images() {
  local product ensured=0
  for product in "${WEBINO_SUPPORTED_PRODUCTS[@]}"; do
    if product_source_ready "$product"; then
      product_ensure_images "$product"
      ensured=1
    fi
  done
  if [[ "$ensured" -eq 0 ]]; then
    warn "No products installed yet. Run: webina product install Webino"
    return 0
  fi
}
