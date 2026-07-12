#!/usr/bin/env bash
# Per-site docker-compose template (rendered with envsubst).

render_site_compose() {
  local slug="$1"
  local out product backend_image next_image
  out="$(site_compose_file "$slug")"
  local template="${ROOT}/scripts/platform/site-compose.template.yml"
  product=$(site_product "$slug")
  backend_image=$(product_backend_image "$product")
  next_image=$(product_next_image "$product")

  SLUG="$slug" \
  BACKEND_CONTAINER="$(site_backend_container "$slug")" \
  NEXT_CONTAINER="$(site_next_container "$slug")" \
  BACKEND_IMAGE="$backend_image" \
  NEXT_IMAGE="$next_image" \
  REDIS_HOST="$WEBINO_REDIS_CONTAINER" \
  NETWORK_NAME="$WEBINA_NETWORK" \
  envsubst '${SLUG} ${BACKEND_CONTAINER} ${NEXT_CONTAINER} ${BACKEND_IMAGE} ${NEXT_IMAGE} ${REDIS_HOST} ${NETWORK_NAME}' \
    <"$template" >"$out"

  log "Generated $out (product=${product})"
}
