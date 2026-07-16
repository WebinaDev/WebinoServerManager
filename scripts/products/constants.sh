#!/usr/bin/env bash
# Product catalog: names, repos, image tags, and source paths.

_PKG_URLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../install" && pwd)"
# shellcheck source=scripts/install/package-urls.sh
source "${_PKG_URLS_DIR}/package-urls.sh"

WEBINO_PRODUCT_BRANCH="${WEBINO_PRODUCT_BRANCH:-main}"
WEBINO_SUPPORTED_PRODUCTS=(Webino WebinoERM)

product_normalize() {
  case "$1" in
    Webino|webino) printf 'Webino' ;;
    WebinoERM|WebinoERP|webinoerm|webinoerp) printf 'WebinoERM' ;;
    *) return 1 ;;
  esac
}

product_repo_slug() {
  case "$(product_normalize "$1")" in
    Webino) printf 'WebinaDev/WebinoDashboard' ;;
    WebinoERM) printf 'WebinaDev/WebinoERP' ;;
    *) return 1 ;;
  esac
}

product_slug_key() {
  case "$(product_normalize "$1")" in
    Webino) printf 'webino' ;;
    WebinoERM) printf 'webinoerm' ;;
    *) return 1 ;;
  esac
}

product_backend_image() {
  local key
  key="$(product_slug_key "$1")" || return 1
  printf '%s-backend:latest' "$key"
}

product_next_image() {
  local key
  key="$(product_slug_key "$1")" || return 1
  printf '%s-next:latest' "$key"
}

product_source_dir() {
  local product
  product="$(product_normalize "$1")" || return 1
  if [[ -n "${WEBINA_PRODUCTS_DIR:-}" ]]; then
    printf '%s/%s' "$WEBINA_PRODUCTS_DIR" "$product"
    return 0
  fi
  local data_root="${WEBINA_DATA_ROOT:-${WEBINO_DATA_ROOT:-/var/lib/webina}}"
  printf '%s/products/%s' "$data_root" "$product"
}

product_local_monorepo_path() {
  local product
  product="$(product_normalize "$1")" || return 1
  [[ -n "${ROOT:-}" ]] || return 1
  local -a dir_names=("$product")
  if [[ "$product" == "Webino" ]]; then
    dir_names+=(WebinoDashboard)
  elif [[ "$product" == "WebinoERM" ]]; then
    dir_names+=(WebinoERP)
  fi
  local name candidate
  for name in "${dir_names[@]}"; do
    candidate="${ROOT}/../${name}"
    if [[ -d "${candidate}/backend" && -d "${candidate}/frontend" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

product_env_example_path() {
  local src="$1"
  if [[ -f "${src}/backend/.env.example" ]]; then
    printf '%s/backend/.env.example' "$src"
  else
    return 1
  fi
}

product_backend_dockerfile() {
  local src="$1"
  if [[ -f "${src}/docker/php/Dockerfile.platform" ]]; then
    printf '%s/docker/php/Dockerfile.platform' "$src"
  else
    return 1
  fi
}

product_next_dockerfile() {
  local src="$1"
  if [[ -f "${src}/docker/next/Dockerfile" ]]; then
    printf '%s/docker/next/Dockerfile' "$src"
  else
    return 1
  fi
}

product_is_valid() {
  product_normalize "$1" >/dev/null 2>&1
}

product_require_valid() {
  product_is_valid "$1" || die "Unknown product: $1 (supported: Webino, WebinoERM)"
}
