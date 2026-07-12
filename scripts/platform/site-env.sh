#!/usr/bin/env bash
# Generate per-site backend .env from product source.

generate_site_env() {
  local slug="$1" domain="$2" aliases_csv="${3:-}" product="${4:-Webino}" channel="${5:-Dev}"
  local env_file site_path example src
  product="$(product_normalize "$product")" || product="$WEBINO_DEFAULT_PRODUCT"
  src=$(product_source_dir "$product")
  product_source_ready "$product" || die "Product ${product} is not installed. Run: webina product install ${product}"

  site_path="$(site_dir "$slug")/backend"
  env_file="${site_path}/.env"
  example=$(product_env_example_path "$src") || die "Missing .env.example for product ${product}"

  mkdir -p "${site_path}/database" "${site_path}/storage/framework/cache" \
    "${site_path}/storage/framework/sessions" "${site_path}/storage/framework/views" \
    "${site_path}/storage/logs" "${site_path}/bootstrap/cache"

  cp "$example" "$env_file"
  touch "${site_path}/database/database.sqlite"

  local scheme="https"
  local app_url="${scheme}://${domain}"
  local frontend_url="$app_url"

  local cors="${app_url}"
  local sanctum="${domain}"
  local alias
  IFS=',' read -ra alias_arr <<< "$aliases_csv"
  for alias in "${alias_arr[@]}"; do
    alias="${alias// /}"
    [[ -n "$alias" ]] || continue
    cors="${cors},${scheme}://${alias}"
    sanctum="${sanctum},${alias}"
  done

  patch_env "$env_file" APP_NAME "${product}-${slug}"
  patch_env "$env_file" APP_ENV production
  patch_env "$env_file" APP_DEBUG false
  patch_env "$env_file" APP_URL "$app_url"
  patch_env "$env_file" FRONTEND_URL "$frontend_url"
  patch_env "$env_file" REDIS_HOST "$WEBINO_REDIS_CONTAINER"
  patch_env "$env_file" REDIS_PREFIX "webino_${slug}_"
  patch_env "$env_file" CACHE_STORE redis
  patch_env "$env_file" SESSION_DRIVER redis
  patch_env "$env_file" QUEUE_CONNECTION redis
  patch_env "$env_file" CORS_ALLOWED_ORIGINS "$cors"
  patch_env "$env_file" SANCTUM_STATEFUL_DOMAINS "$sanctum"
  patch_env "$env_file" AUTH_COOKIE_NAME webino_auth_token

  if ! grep -q '^APP_KEY=base64:' "$env_file" 2>/dev/null; then
    local app_key
    app_key="$(python3 -c 'import base64, os; print("base64:" + base64.b64encode(os.urandom(32)).decode())')"
    patch_env "$env_file" APP_KEY "$app_key"
  fi

  chmod 600 "$env_file" 2>/dev/null || true
  log "Generated ${env_file} (product=${product})"
}

apply_env_patch_base64() {
  local slug="$1" patch_b64="$2"
  local env_file
  env_file="$(site_dir "$slug")/backend/.env"
  [[ -f "$env_file" ]] || die "Missing env file for site $slug"

  python3 - "$env_file" "$patch_b64" <<'PY'
import base64, json, sys, re

env_file, patch_b64 = sys.argv[1], sys.argv[2]
try:
    data = json.loads(base64.b64decode(patch_b64).decode('utf-8'))
except Exception as e:
    raise SystemExit(f"Invalid env patch: {e}")

if not isinstance(data, dict):
    raise SystemExit("env patch must be object")

allowed = {
    "WEBINO_BASE_URL", "TENANT_LICENSE_KEY", "TENANT_PROVISION_TOKEN", "TENANT_SEED_JSON",
    "APP_NAME", "MODULE_GIT_CRM_AUTH",
    "MARKETING_IMPORT_WORDPRESS_URL",
}

with open(env_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def patch_key(key, val):
    global lines
    val = str(val).replace('\n', '')
    pat = re.compile(r'^' + re.escape(key) + r'=.*$', re.M)
    if pat.search(''.join(lines)):
        lines = [pat.sub(f"{key}={val}", ln) if ln.startswith(key + '=') else ln for ln in lines]
    else:
        lines.append(f"{key}={val}\n")

for k, v in data.items():
    if k not in allowed:
        continue
    patch_key(k, v)

with open(env_file, 'w', encoding='utf-8') as f:
    f.writelines(lines)
PY
  log "Applied env patch for site ${slug}"
}

write_site_meta() {
  local slug="$1" domain="$2" aliases_csv="${3:-}" preserve_created="${4:-false}" product="${5:-Webino}" channel="${6:-Dev}"
  local meta
  meta="$(site_dir "$slug")/site.meta.json"
  python3 - "$meta" "$slug" "$domain" "$aliases_csv" "$preserve_created" "$product" "$channel" <<'PY'
import json, sys, datetime
meta, slug, domain, aliases_csv, preserve, product, channel = sys.argv[1:8]
aliases = [a.strip() for a in aliases_csv.split(",") if a.strip()] if aliases_csv else []
created_at = None
if preserve == "true":
    try:
        created_at = json.load(open(meta)).get("created_at")
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
if not created_at:
    created_at = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
doc = {
    "slug": slug,
    "domain": domain,
    "aliases": aliases,
    "product": product,
    "channel": channel,
    "created_at": created_at,
}
json.dump(doc, open(meta, "w"), indent=2)
PY
  chmod 600 "$meta" 2>/dev/null || true
}
