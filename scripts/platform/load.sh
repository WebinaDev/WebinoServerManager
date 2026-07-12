#!/usr/bin/env bash
# Load all platform management modules.

_WEBINO_PLATFORM_LOADED="${_WEBINO_PLATFORM_LOADED:-0}"

load_platform_libs() {
  [[ "$_WEBINO_PLATFORM_LOADED" == "1" ]] && return 0
  [[ -n "${ROOT:-}" ]] || die "ROOT is not set — cannot load platform libraries"

  local dir="${ROOT}/scripts/platform"
  # shellcheck source=scripts/platform/constants.sh
  source "${dir}/constants.sh"
  load_platform_config
  # shellcheck source=scripts/products/load.sh
  source "${ROOT}/scripts/products/load.sh"
  load_products_libs
  # shellcheck source=scripts/platform/registry.sh
  source "${dir}/registry.sh"
  # shellcheck source=scripts/platform/caddy.sh
  source "${dir}/caddy.sh"
  # shellcheck source=scripts/platform/images.sh
  source "${dir}/images.sh"
  # shellcheck source=scripts/platform/site-env.sh
  source "${dir}/site-env.sh"
  # shellcheck source=scripts/platform/site-render.sh
  source "${dir}/site-render.sh"
  # shellcheck source=scripts/platform/container.sh
  source "${dir}/container.sh"
  # shellcheck source=scripts/platform/site-create.sh
  source "${dir}/site-create.sh"
  # shellcheck source=scripts/platform/site-delete.sh
  source "${dir}/site-delete.sh"
  # shellcheck source=scripts/platform/init.sh
  source "${dir}/init.sh"

  _WEBINO_PLATFORM_LOADED=1
}

if [[ "${WEBINO_DEFER_PLATFORM_LOAD:-0}" != "1" ]] && [[ -n "${ROOT:-}" ]]; then
  load_platform_libs
fi
