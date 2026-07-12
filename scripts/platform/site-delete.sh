#!/usr/bin/env bash
# Delete an isolated Webino site.

delete_site() {
  local slug="$1"
  local confirm_slug="${2:-}"

  [[ -n "$slug" ]] || die "Site slug is required"
  registry_site_exists "$slug" || die "Site not found: $slug"

  if [[ -n "$confirm_slug" && "$confirm_slug" != "$slug" ]]; then
    die "Confirmation slug mismatch"
  fi

  log "Deleting site '$slug'..."

  if [[ -f "$(site_compose_file "$slug")" ]]; then
    webina_compose -f "$(site_compose_file "$slug")" -p "$(site_project_name "$slug")" down -v 2>/dev/null || true
  fi

  registry_remove_site "$slug"
  caddy_sync

  if [[ -d "$(site_dir "$slug")" ]]; then
    rm -rf "$(site_dir "$slug")"
    log "Removed $(site_dir "$slug")"
  fi

  log "Site '$slug' deleted"
}

update_site_domain() {
  local slug="$1" domain="$2" aliases_csv="${3:-}"

  registry_site_exists "$slug" || die "Site not found: $slug"
  [[ -n "$domain" ]] || die "Domain is required"
  domain="${domain,,}"
  validate_domain "$domain" || die "Invalid domain: $domain (use a valid hostname, no spaces)"
  validate_aliases "$aliases_csv" || die "Invalid alias in: $aliases_csv"

  registry_update_site "$slug" "$domain" "$aliases_csv"
  generate_site_env "$slug" "$domain" "$aliases_csv"
  write_site_meta "$slug" "$domain" "$aliases_csv" true

  site_compose "$slug" up -d --force-recreate backend next \
    || die "Failed to recreate site containers after domain update"

  caddy_sync

  log "Domain updated for '$slug': https://${domain}"
}
