#!/usr/bin/env bash
# Non-interactive server bootstrap for production VPS.
set -euo pipefail

run_server_bootstrap() {
  local t0=$SECONDS step_t=$SECONDS
  log "WebinoServer bootstrap (multi-site platform)"

  # shellcheck source=scripts/install/deps.sh
  source "${ROOT}/scripts/install/deps.sh"
  log "Checking system dependencies..."
  ensure_system_deps
  log "System dependencies ready ($((SECONDS - step_t))s)"
  step_t=$SECONDS

  run_preflight_server || die "Server preflight failed. See remediation hints above."
  log "Preflight passed ($((SECONDS - step_t))s)"
  step_t=$SECONDS

  register_webina_cli || warn "Could not link webina CLI globally — control panel still works via ${ROOT}/bin/webina"

  # shellcheck source=scripts/platform/load.sh
  source "${ROOT}/scripts/platform/load.sh"

  if platform_is_initialized; then
    log "Platform already initialized at ${WEBINA_DATA_ROOT} ($((SECONDS - step_t))s)"
    platform_status
    if ! platform_stack_running; then
      warn "Platform stack stopped — repairing..."
      platform_repair
    fi
  else
    log "Initializing platform..."
    init_platform
    log "Platform initialized ($((SECONDS - step_t))s)"
  fi

  log "Server bootstrap complete ($((SECONDS - t0))s total)"

  cat <<EOF

================================================================================
 WebinoServer platform is ready.
================================================================================

 Data root: ${WEBINA_DATA_ROOT}

 Next steps:
   webina                          Open control panel
   webina product install Webino   Install Webino product
   webina product install WebinoERM
   webina site create --slug shop1 --domain shop.example.com --product Webino

================================================================================
EOF
}
