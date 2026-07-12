#!/usr/bin/env bash
# Load product acquisition and management modules.

_WEBINO_PRODUCTS_LOADED="${_WEBINO_PRODUCTS_LOADED:-0}"

load_products_libs() {
  [[ "$_WEBINO_PRODUCTS_LOADED" == "1" ]] && return 0
  local dir="${ROOT}/scripts/products"
  # shellcheck source=scripts/products/constants.sh
  source "${dir}/constants.sh"
  # shellcheck source=scripts/products/acquire.sh
  source "${dir}/acquire.sh"
  # shellcheck source=scripts/products/docker-build.sh
  source "${dir}/docker-build.sh"
  # shellcheck source=scripts/products/manage.sh
  source "${dir}/manage.sh"
  _WEBINO_PRODUCTS_LOADED=1
}
