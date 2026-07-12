#!/usr/bin/env bash
# Site registry stored in /var/lib/webina/registry.json

registry_init() {
  if [[ ! -f "$WEBINA_REGISTRY_FILE" ]]; then
    printf '{"sites":[]}\n' >"$WEBINA_REGISTRY_FILE"
    log "Created registry at $WEBINA_REGISTRY_FILE"
  fi
  registry_secure
}

registry_secure() {
  [[ -f "$WEBINA_REGISTRY_FILE" ]] && chmod 600 "$WEBINA_REGISTRY_FILE" 2>/dev/null || true
}

registry_require_python() {
  have python3 || die "python3 is required for site registry operations"
}

registry_list_slugs() {
  registry_require_python
  python3 - "$WEBINA_REGISTRY_FILE" <<'PY'
import json, sys
path = sys.argv[1]
try:
    data = json.load(open(path))
except FileNotFoundError:
    sys.exit(0)
except json.JSONDecodeError:
    data = {"sites": []}
for s in data.get("sites", []):
    print(s.get("slug", ""))
PY
}

registry_site_exists() {
  local slug="$1"
  registry_list_slugs | grep -qx "$slug"
}

registry_get_field() {
  local slug="$1" field="$2"
  registry_require_python
  python3 - "$WEBINA_REGISTRY_FILE" "$slug" "$field" <<'PY'
import json, sys
path, slug, field = sys.argv[1:4]
data = json.load(open(path))
for s in data.get("sites", []):
    if s.get("slug") == slug:
        val = s.get(field, "")
        if isinstance(val, list):
            print(",".join(val))
        else:
            print(val)
        break
PY
}

registry_add_site() {
  local slug="$1" domain="$2" aliases_csv="${3:-}" product="${4:-Webino}" channel="${5:-Dev}"
  registry_require_python
  python3 - "$WEBINA_REGISTRY_FILE" "$slug" "$domain" "$aliases_csv" "$(site_dir "$slug")" "$product" "$channel" <<'PY'
import json, sys, datetime
path, slug, domain, aliases_csv, site_path, product, channel = sys.argv[1:8]
aliases = [a.strip() for a in aliases_csv.split(",") if a.strip()] if aliases_csv else []
try:
    data = json.load(open(path))
except FileNotFoundError:
    data = {"sites": []}
sites = data.get("sites", [])
if any(s.get("slug") == slug for s in sites):
    raise SystemExit(f"Site already exists: {slug}")
sites.append({
    "slug": slug,
    "domain": domain,
    "aliases": aliases,
    "product": product,
    "channel": channel,
    "status": "created",
    "created_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "path": site_path,
})
data["sites"] = sorted(sites, key=lambda s: s.get("slug", ""))
json.dump(data, open(path, "w"), indent=2)
print("ok")
PY
  registry_secure
}

registry_remove_site() {
  local slug="$1"
  registry_require_python
  python3 - "$WEBINA_REGISTRY_FILE" "$slug" <<'PY'
import json, sys
path, slug = sys.argv[1:3]
data = json.load(open(path))
before = len(data.get("sites", []))
data["sites"] = [s for s in data.get("sites", []) if s.get("slug") != slug]
if len(data["sites"]) == before:
    raise SystemExit(f"Site not found: {slug}")
json.dump(data, open(path, "w"), indent=2)
print("ok")
PY
  registry_secure
}

registry_update_site() {
  local slug="$1" domain="$2" aliases_csv="${3:-}"
  registry_require_python
  python3 - "$WEBINA_REGISTRY_FILE" "$slug" "$domain" "$aliases_csv" <<'PY'
import json, sys
path, slug, domain, aliases_csv = sys.argv[1:5]
aliases = [a.strip() for a in aliases_csv.split(",") if a.strip()] if aliases_csv else []
data = json.load(open(path))
found = False
for s in data.get("sites", []):
    if s.get("slug") == slug:
        s["domain"] = domain
        s["aliases"] = aliases
        found = True
        break
if not found:
    raise SystemExit(f"Site not found: {slug}")
json.dump(data, open(path, "w"), indent=2)
print("ok")
PY
  registry_secure
}

registry_update_status() {
  local slug="$1" status="$2"
  registry_require_python
  python3 - "$WEBINA_REGISTRY_FILE" "$slug" "$status" <<'PY'
import json, sys
path, slug, status = sys.argv[1:4]
data = json.load(open(path))
for s in data.get("sites", []):
    if s.get("slug") == slug:
        s["status"] = status
        break
else:
    raise SystemExit(f"Site not found: {slug}")
json.dump(data, open(path, "w"), indent=2)
PY
  registry_secure
}

registry_count() {
  registry_list_slugs | wc -l | tr -d ' '
}

registry_format_site_line() {
  local slug="$1"
  local domain status product
  domain=$(registry_get_field "$slug" domain)
  product=$(registry_get_field "$slug" product)
  [[ -n "$product" ]] || product="$WEBINO_DEFAULT_PRODUCT"
  status=$(site_container_status "$slug" 2>/dev/null || echo "unknown")
  printf '%s | %s | %s | %s' "$slug" "$product" "$domain" "$status"
}
