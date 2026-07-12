#!/usr/bin/env bash
# Generate and reload Caddy config for all registered sites.

caddy_render_config() {
  local caddyfile="${WEBINA_PLATFORM_DIR}/Caddyfile"
  local template="${ROOT}/scripts/platform/Caddyfile.template"

  cp "$template" "$caddyfile"

  registry_require_python
  python3 - "$WEBINA_REGISTRY_FILE" "$caddyfile" <<'PY'
import json, sys

registry_path, caddyfile_path = sys.argv[1:3]
try:
    data = json.load(open(registry_path))
except FileNotFoundError:
    data = {"sites": []}

blocks = []
for site in data.get("sites", []):
    slug = site.get("slug", "")
    domain = site.get("domain", "")
    aliases = site.get("aliases") or []
    hosts = [domain] + [a for a in aliases if a and a != domain]
    hosts = [h for h in hosts if h]
    if not slug or not hosts:
        continue
    host_line = ", ".join(hosts)
    blocks.append(f"""
{host_line} {{
	encode zstd gzip

	@nextStatic path /_next/static/*
	header @nextStatic Cache-Control "public, max-age=31536000, immutable"

	@api path /api/*
	header @api Cache-Control "no-store"

	handle /api/* {{
		reverse_proxy {slug}-backend:8080
	}}

	handle {{
		reverse_proxy {slug}-next:3000
	}}
}}
""")

fallback = """
:80 {
	respond "Webino platform is running. No sites configured." 200
}
"""

with open(caddyfile_path, "a") as f:
    if blocks:
        f.write("\n".join(blocks))
    else:
        f.write(fallback)
PY

  log "Rendered Caddyfile with $(registry_count) site(s)"
}

caddy_reload() {
  have docker || return 1
  if docker ps --format '{{.Names}}' | grep -qx "$WEBINO_CADDY_CONTAINER"; then
    if docker exec "$WEBINO_CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile; then
      log "Caddy reloaded"
      return 0
    fi
    warn "Caddy reload command failed"
    return 1
  fi
  warn "Caddy container not running; config written for next start"
  return 1
}

caddy_sync() {
  caddy_render_config
  caddy_reload
}

caddy_ssl_status() {
  local slug="$1"
  local domain
  domain=$(registry_get_field "$slug" domain)
  local cert_dir="${WEBINA_PLATFORM_DIR}/caddy-data/caddy/certificates"
  if [[ -d "$cert_dir" ]] && find "$cert_dir" -name "*.crt" 2>/dev/null | grep -qi "$domain"; then
    printf 'issued'
  elif docker exec "$WEBINO_CADDY_CONTAINER" caddy list-certificates 2>/dev/null | grep -q "$domain"; then
    printf 'issued'
  else
    printf 'pending (ensure DNS points to this server)'
  fi
}
