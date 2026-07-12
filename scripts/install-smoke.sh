#!/usr/bin/env bash
# End-to-end install smoke test for WebinoServer (local CI / pre-release).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/install/common.sh
source "${ROOT}/scripts/install/common.sh"
source "${ROOT}/scripts/install/preflight.sh"

pass=0
fail=0
skip=0

ok() {
  echo "OK: $1"
  pass=$((pass + 1))
}

bad() {
  echo "FAIL: $1"
  fail=$((fail + 1))
}

skipped() {
  echo "SKIP: $1"
  skip=$((skip + 1))
}

echo "WebinoServer install smoke test"
echo "==============================="
echo

echo "--- Package server ---"
if [[ "${INSTALL_SMOKE_SKIP_NETWORK:-0}" == "1" ]]; then
  skipped "package server checks (INSTALL_SMOKE_SKIP_NETWORK=1)"
else
  if bash "${ROOT}/scripts/verify-package-server.sh"; then
    ok "package server endpoints"
  else
    bad "package server endpoints"
  fi
fi

echo
echo "--- Preflight (dry) ---"
export PREFLIGHT_SKIP_ROOT=1
export WEBINA_DATA_ROOT="${WEBINA_DATA_ROOT:-/var/lib/webina}"
if ! have docker || ! docker info >/dev/null 2>&1; then
  skipped "preflight (Docker not available in this environment)"
else
  if run_preflight_server; then
    ok "server preflight"
  else
    bad "server preflight"
  fi

  if run_preflight_panel; then
    ok "panel preflight"
  else
    bad "panel preflight"
  fi
fi

echo
echo "--- Monorepo product detection ---"
# shellcheck source=scripts/products/constants.sh
source "${ROOT}/scripts/products/constants.sh"
if path=$(product_local_monorepo_path Webino 2>/dev/null); then
  ok "Webino local path: ${path}"
else
  skipped "Webino local monorepo (not in workspace)"
fi
if path=$(product_local_monorepo_path WebinoERM 2>/dev/null); then
  ok "WebinoERM local path: ${path}"
else
  skipped "WebinoERM/WebinoERP local monorepo (not in workspace)"
fi

echo
echo "--- Install deps / compose ---"
# shellcheck source=scripts/install/deps.sh
source "${ROOT}/scripts/install/deps.sh"
if bash -n "${ROOT}/scripts/install/deps.sh"; then
  ok "deps.sh syntax"
else
  bad "deps.sh syntax"
fi
if declare -f webina_compose >/dev/null 2>&1 \
  && declare -f webina_compose_available >/dev/null 2>&1 \
  && declare -f webina_compose_verify >/dev/null 2>&1 \
  && declare -f webina_compose_diagnose >/dev/null 2>&1 \
  && declare -f webina_compose_v2_works >/dev/null 2>&1 \
  && declare -f webina_compose_legacy_works >/dev/null 2>&1; then
  ok "webina_compose helpers"
else
  bad "webina_compose helpers"
fi
if grep -q 'webina_compose_verify' "${ROOT}/scripts/install/common.sh" \
  && grep -A3 'webina_compose_available()' "${ROOT}/scripts/install/common.sh" | grep -q 'webina_compose_verify'; then
  ok "webina_compose_available uses functional verify"
else
  bad "webina_compose_available uses functional verify"
fi
if grep -q 'deps_install_compose_plugin_binary' "${ROOT}/scripts/install/deps.sh" \
  && grep -q 'docker-compose-v2' "${ROOT}/scripts/install/deps.sh" \
  && grep -q 'webina_compose_diagnose' "${ROOT}/scripts/install/deps.sh"; then
  ok "deps compose install fallbacks"
else
  bad "deps compose install fallbacks"
fi
tmpdir=$(mktemp -d)
printf '#!/bin/sh\nexit 1\n' >"${tmpdir}/docker-compose"
chmod +x "${tmpdir}/docker-compose"
PATH="${tmpdir}:${PATH}"
if webina_compose_legacy_works; then
  bad "broken docker-compose shim must not pass legacy check"
else
  ok "broken docker-compose shim rejected"
fi
rm -rf "$tmpdir"
if grep -q 'webina_compose' "${ROOT}/scripts/platform/container.sh" \
  && grep -q 'webina_compose' "${ROOT}/scripts/install/panel.sh"; then
  ok "compose call sites use webina_compose"
else
  bad "compose call sites use webina_compose"
fi

echo
echo "--- Docker registry helpers ---"
# shellcheck source=scripts/install/docker-registry.sh
source "${ROOT}/scripts/install/docker-registry.sh"
if bash -n "${ROOT}/scripts/install/docker-registry.sh"; then
  ok "docker-registry.sh syntax"
else
  bad "docker-registry.sh syntax"
fi

images=$(panel_compose_image_list "${ROOT}/panel/.env.example")
if [[ -n "$images" ]] && echo "$images" | grep -q 'mariadb:11'; then
  ok "panel_compose_image_list defaults"
else
  bad "panel_compose_image_list defaults"
fi

platform_images=$(platform_compose_image_list)
if [[ -n "$platform_images" ]] && echo "$platform_images" | grep -q 'redis:7-alpine'; then
  ok "platform_compose_image_list defaults"
else
  bad "platform_compose_image_list defaults"
fi

build_images=$(panel_build_image_list)
if [[ -n "$build_images" ]] && echo "$build_images" | grep -q 'golang:1.22-bookworm'; then
  ok "panel_build_image_list defaults"
else
  bad "panel_build_image_list defaults"
fi

agent_dockerfile="${ROOT}/panel/docker/agent/Dockerfile"
if grep -q 'GOPROXY' "$agent_dockerfile" && grep -q 'GOSUMDB=off' "$agent_dockerfile" && grep -q 'mariadb-client' "$agent_dockerfile"; then
  ok "panel-agent Dockerfile (GOPROXY + GOSUMDB + mariadb-client)"
else
  bad "panel-agent Dockerfile (GOPROXY + GOSUMDB + mariadb-client)"
fi

if grep -rq 'mysql-client' "${ROOT}/panel/docker" 2>/dev/null; then
  bad "panel dockerfiles still reference mysql-client"
else
  ok "panel dockerfiles avoid mysql-client"
fi

panel_php_dockerfile="${ROOT}/panel/docker/php/Dockerfile"
if grep -q 'composer update' "$panel_php_dockerfile" \
  && grep -q 'composer.json backend/composer.lock' "$panel_php_dockerfile"; then
  ok "panel PHP Dockerfile composer.lock fallback"
else
  bad "panel PHP Dockerfile composer.lock fallback"
fi

panel_composer="${ROOT}/panel/backend/composer.json"
if [[ -f "$panel_composer" ]] \
  && ! grep -q 'google2fa-laravel' "$panel_composer" \
  && grep -q '"laravel/octane": "\^2.17"' "$panel_composer" \
  && grep -q '"nwidart/laravel-modules": "\^13.0"' "$panel_composer" \
  && grep -qE '"spatie/laravel-permission": "\^(7|8)\.' "$panel_composer" \
  && grep -q '"pragmarx/google2fa": "\^8.0"' "$panel_composer" \
  && grep -q '"dedoc/scramble": "\^0.13"' "$panel_composer"; then
  ok "panel composer.json Laravel 13 constraints"
else
  bad "panel composer.json Laravel 13 constraints"
fi

if grep -q 'wikimedia/composer-merge-plugin' "$panel_composer"; then
  ok "panel composer.json allows laravel-modules merge plugin"
else
  bad "panel composer.json allows laravel-modules merge plugin"
fi

echo
echo "--- Panel frontend ---"
panel_frontend="${ROOT}/panel/frontend"
if [[ -f "${panel_frontend}/src/hooks/usePermissions.tsx" ]] \
  && [[ ! -f "${panel_frontend}/src/hooks/usePermissions.ts" ]]; then
  ok "usePermissions hook uses .tsx extension"
else
  bad "usePermissions hook uses .tsx extension"
fi
jsx_in_ts=0
while IFS= read -r -d '' hook_file; do
  if grep -q 'return <' "$hook_file"; then
    bad "$(basename "$hook_file"): JSX in .ts hook file"
    jsx_in_ts=1
  fi
done < <(find "${panel_frontend}/src/hooks" -maxdepth 1 -name '*.ts' -print0 2>/dev/null)
if [[ "$jsx_in_ts" -eq 0 ]]; then
  ok "panel hooks .ts files avoid JSX"
fi
if grep -rq '@/lib/createPage' "${panel_frontend}" 2>/dev/null; then
  bad "panel frontend imports wrong @/lib/createPage path"
else
  ok "panel frontend uses @/lib/create-page import"
fi

echo
echo "--- PHP Dockerfile dev packages ---"
php_dockerfiles=(
  "${ROOT}/panel/docker/php/Dockerfile"
  "${ROOT}/../Webino/docker/php/Dockerfile.platform"
  "${ROOT}/../Webino/docker/php/Dockerfile"
  "${ROOT}/../WebinoERP/docker/php/Dockerfile.platform"
)
php_ext_ok=1
for df in "${php_dockerfiles[@]}"; do
  [[ -f "$df" ]] || continue
  ext_line=$(grep -E 'docker-php-ext-install' "$df" | head -1 || true)
  [[ -n "$ext_line" ]] || continue
  if echo "$ext_line" | grep -qE '\b(dom|xml)\b'; then
    if ! grep -q 'libxml2-dev' "$df"; then
      bad "$(basename "$(dirname "$df")")/$(basename "$df"): dom/xml without libxml2-dev"
      php_ext_ok=0
    fi
  fi
  if echo "$ext_line" | grep -q 'pdo_sqlite'; then
    if ! grep -q 'libsqlite3-dev' "$df"; then
      bad "$(basename "$(dirname "$df")")/$(basename "$df"): pdo_sqlite without libsqlite3-dev"
      php_ext_ok=0
    fi
  fi
  if echo "$ext_line" | grep -q 'pdo_mysql'; then
    if ! grep -q 'default-libmysqlclient-dev' "$df"; then
      bad "$(basename "$(dirname "$df")")/$(basename "$df"): pdo_mysql without default-libmysqlclient-dev"
      php_ext_ok=0
    fi
  fi
  if grep -q 'install-redis.sh' "$df"; then
    if ! grep -q 'PHPIZE_DEPS' "$df"; then
      bad "$(basename "$(dirname "$df")")/$(basename "$df"): redis install without PHPIZE_DEPS"
      php_ext_ok=0
    fi
    redis_script_dir=$(dirname "$df")
    if [[ ! -f "${redis_script_dir}/install-redis.sh" ]]; then
      bad "$(basename "$(dirname "$df")")/$(basename "$df"): install-redis.sh missing"
      php_ext_ok=0
    elif ! grep -q 'phpredis' "${redis_script_dir}/install-redis.sh"; then
      bad "$(basename "$(dirname "$df")")/$(basename "$df"): install-redis.sh missing GitHub phpredis fallback"
      php_ext_ok=0
    fi
  elif grep -q 'pecl install redis' "$df"; then
    bad "$(basename "$(dirname "$df")")/$(basename "$df"): bare pecl install redis without install-redis.sh fallback"
    php_ext_ok=0
  fi
done
if [[ "$php_ext_ok" -eq 1 ]]; then
  ok "PHP Dockerfiles include libxml2-dev / libsqlite3-dev / mysql dev / PHPIZE_DEPS where needed"
fi

echo
echo "--- Panel agent compile ---"
if have go; then
  if (cd "${ROOT}/panel/agent" && go build -o /dev/null .); then
    ok "panel-agent go build"
  else
    bad "panel-agent go build"
  fi
else
  skipped "panel-agent go build (go not installed)"
fi

if [[ "${INSTALL_SMOKE_SKIP_NETWORK:-0}" == "1" ]]; then
  skipped "docker_registry_test_hub (INSTALL_SMOKE_SKIP_NETWORK=1)"
else
  hub_status=0
  docker_registry_test_hub || hub_status=$?
  case "$hub_status" in
    0) ok "Docker Hub reachable (401/200)" ;;
    2) ok "Docker Hub test detected 403 (mirror fallback path)" ;;
    *) skipped "Docker Hub test inconclusive (code ${hub_status})" ;;
  esac
fi

echo
echo "--- Panel compose smoke ---"
if [[ "${INSTALL_SMOKE_SKIP_COMPOSE:-0}" == "1" ]]; then
  skipped "panel compose smoke (INSTALL_SMOKE_SKIP_COMPOSE=1)"
elif ! have docker || ! docker info >/dev/null 2>&1; then
  skipped "panel compose smoke (Docker not available)"
else
  if bash "${ROOT}/panel/scripts/ci-compose-smoke.sh"; then
    ok "panel compose smoke"
  else
    bad "panel compose smoke"
  fi
fi

echo
echo "Result: ${pass} passed, ${fail} failed, ${skip} skipped"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
echo "All smoke checks passed."
exit 0
