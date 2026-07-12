#!/usr/bin/env bash
# Create a new isolated site for a product.

validate_domain() {
  local domain="$1"
  [[ "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]{0,253}[a-zA-Z0-9])?$ ]] || return 1
  [[ "$domain" != *" "* ]] || return 1
  return 0
}

validate_aliases() {
  local aliases_csv="$1" alias
  [[ -z "$aliases_csv" ]] && return 0
  IFS=',' read -ra parts <<< "$aliases_csv"
  for alias in "${parts[@]}"; do
    alias="${alias// /}"
    [[ -z "$alias" ]] || continue
    validate_domain "$alias" || return 1
  done
  return 0
}

site_create_rollback() {
  local slug="$1"
  warn "Rolling back partial site creation for '$slug'..."
  if [[ -f "$(site_compose_file "$slug")" ]]; then
    webina_compose -f "$(site_compose_file "$slug")" -p "$(site_project_name "$slug")" down -v 2>/dev/null || true
  fi
  if registry_site_exists "$slug" 2>/dev/null; then
    registry_remove_site "$slug" 2>/dev/null || true
    caddy_sync 2>/dev/null || true
  fi
  if [[ -d "$(site_dir "$slug")" ]]; then
    rm -rf "$(site_dir "$slug")"
  fi
}

# create_site SLUG DOMAIN [ALIASES] [PRODUCT] [CHANNEL] [ENV_PATCH_B64]
create_site() {
  local slug="$1" domain="$2" aliases_csv="${3:-}" product="${4:-$WEBINO_DEFAULT_PRODUCT}" channel="${5:-Dev}" env_patch_b64="${6:-}"

  slug="${slug,,}"
  slug="${slug// /-}"
  domain="${domain,,}"
  product="$(product_normalize "$product")" || die "Unknown product: $product"
  validate_site_slug "$slug" || die "Invalid slug: $slug (use lowercase letters, numbers, hyphens)"
  [[ -n "$domain" ]] || die "Domain is required"
  validate_domain "$domain" || die "Invalid domain: $domain (use a valid hostname, no spaces)"
  validate_aliases "$aliases_csv" || die "Invalid alias in: $aliases_csv"

  platform_ensure_ready
  ensure_product_ready "$product" "$channel"

  if registry_site_exists "$slug"; then
    die "Site already exists: $slug
  Fix: webina site delete $slug --yes   or pick a different slug"
  fi

  if [[ -d "$(site_dir "$slug")" ]]; then
    die "Site directory already exists: $(site_dir "$slug")
  Fix: remove directory or use a different slug"
  fi

  have envsubst || die "envsubst is required (install gettext package)
  Fix: apt install -y gettext-base"
  have docker || die "Docker is required
  Fix: systemctl start docker"

  log "Creating site '$slug' (${product}) for domain '$domain'..."

  mkdir -p "$(site_dir "$slug")"
  generate_site_env "$slug" "$domain" "$aliases_csv" "$product" "$channel"
  if [[ -n "$env_patch_b64" ]]; then
    apply_env_patch_base64 "$slug" "$env_patch_b64"
  fi
  write_site_meta "$slug" "$domain" "$aliases_csv" false "$product" "$channel"
  render_site_compose "$slug"

  if ! bootstrap_site_backend "$slug"; then
    site_create_rollback "$slug"
    die "Backend bootstrap failed for site '$slug'.
  Fix: webina site logs $slug backend --tail 200
  Fix: webina platform status"
  fi

  registry_add_site "$slug" "$domain" "$aliases_csv" "$product" "$channel" || {
    site_create_rollback "$slug"
    die "Failed to add site to registry."
  }

  if ! site_start "$slug"; then
    site_create_rollback "$slug"
    die "Failed to start site '$slug'.
  Fix: webina site logs $slug backend --tail 200"
  fi

  if ! caddy_sync; then
    warn "Caddy sync failed — site containers are running but routing/SSL may be pending."
    warn "Ensure DNS for ${domain} points to this server, then run: webina site domain $slug --set $domain"
  fi

  log "Site '$slug' (${product}) created: https://${domain}"
  if [[ "$product" == "WebinoERM" ]]; then
    log "Default login: admin@webina.local / password"
  else
    log "Default login: admin@example.com / password"
  fi
  warn "SSL note: certificate issues until DNS A/AAAA for ${domain} points to this server."
}

create_site_interactive() {
  local slug domain aliases product channel
  slug="${SITE_SLUG:-}"
  domain="${SITE_DOMAIN:-}"
  aliases="${SITE_ALIASES:-}"
  product="${SITE_PRODUCT:-$WEBINO_DEFAULT_PRODUCT}"
  channel="${SITE_CHANNEL:-Dev}"
  [[ -n "$slug" && -n "$domain" ]] || die "Usage: create_site_interactive requires SITE_SLUG and SITE_DOMAIN"
  create_site "$slug" "$domain" "$aliases" "$product" "$channel"
}
