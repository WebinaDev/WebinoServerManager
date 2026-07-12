#!/usr/bin/env bash
# Smoke test for control panel prerequisites and platform health.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/install/common.sh
source "${ROOT}/scripts/install/common.sh"
export WEBINO_DEFER_PLATFORM_LOAD=1
# shellcheck source=scripts/platform/load.sh
source "${ROOT}/scripts/platform/load.sh"
load_platform_libs

pass=0
fail=0

ok() {
  echo "OK: $1"
  pass=$((pass + 1))
}

bad() {
  echo "FAIL: $1"
  fail=$((fail + 1))
}

echo "WebinoServer control panel verification"
echo "================================="
echo

if have dialog; then
  ok "dialog installed ($(dialog --version 2>&1 | head -1))"
  if [[ -e /dev/tty ]]; then
    if dialog --title "WebinoServer" --msgbox " " 5 20 >/dev/tty 2>/dev/tty </dev/tty 2>/dev/null; then
      ok "dialog works with /dev/tty"
    else
      bad "dialog TTY test failed — use an interactive SSH session (TERM should not be dumb)"
    fi
  else
    bad "/dev/tty not available — control panel needs an interactive terminal"
  fi
else
  bad "dialog not installed — run: apt install -y dialog"
fi

if [[ "${TERM:-dumb}" == "dumb" ]] && [[ ! -e /dev/tty ]]; then
  bad "TERM=dumb without /dev/tty — dialog menus will not work"
fi

if have docker; then
  ok "docker installed"
else
  bad "docker not installed"
fi

if have python3; then
  ok "python3 installed"
else
  bad "python3 not installed — required for site registry"
fi

if have envsubst; then
  ok "envsubst installed"
else
  bad "envsubst not installed — run: apt install -y gettext-base"
fi

echo
echo "Platform checks (${WEBINA_DATA_ROOT})"
echo "-------------------------------------"

if platform_is_initialized; then
  ok "platform initialized"
else
  bad "platform not initialized — run: webina → Platform Setup"
fi

if have docker; then
  if platform_network_exists 2>/dev/null; then
    ok "Docker network ${WEBINA_NETWORK} present"
  else
    bad "Docker network ${WEBINA_NETWORK} missing — run: webina → Platform Setup → Repair"
  fi

  if platform_stack_running; then
    ok "platform stack running (Caddy + Redis)"
  else
    bad "platform stack not running — run: webina → Platform Setup"
  fi

  if platform_images_exist; then
    ok "product images present for installed products"
  else
    bad "product images missing — run: webina product install Webino"
  fi
else
  bad "skipping Docker platform checks — docker not installed"
fi

if [[ -f "$WEBINA_REGISTRY_FILE" && -r "$WEBINA_REGISTRY_FILE" ]]; then
  ok "registry readable ($WEBINA_REGISTRY_FILE)"
  perms=$(stat -c '%a' "$WEBINA_REGISTRY_FILE" 2>/dev/null || echo "unknown")
  if [[ "$perms" == "600" ]]; then
    ok "registry permissions 600"
  else
    bad "registry permissions should be 600 (current: $perms)"
  fi
else
  bad "registry not readable at $WEBINA_REGISTRY_FILE"
fi

site_count=$(registry_count 2>/dev/null || echo 0)
ok "registry lists ${site_count} site(s)"

if command -v webina >/dev/null 2>&1; then
  ok "webina CLI on PATH ($(command -v webina))"
else
  bad "webina CLI not on PATH — run install or add bin to PATH"
fi

echo
echo "Panel stack checks"
echo "------------------"

PANEL_DIR="${ROOT}/panel"
PANEL_COMPOSE="${PANEL_DIR}/docker-compose.panel.yml"
PANEL_ENV="${PANEL_DIR}/.env"
PANEL_HTTP_PORT="${PANEL_HTTP_PORT:-2090}"

if [[ -f "$PANEL_COMPOSE" ]]; then
  ok "panel compose file present"
else
  bad "panel compose file missing at $PANEL_COMPOSE"
fi

if [[ -f "$PANEL_ENV" ]]; then
  ok "panel/.env present"
  perms=$(stat -c '%a' "$PANEL_ENV" 2>/dev/null || echo "unknown")
  if [[ "$perms" == "600" ]]; then
    ok "panel/.env permissions 600"
  else
    bad "panel/.env should be chmod 600 (current: $perms)"
  fi
else
  bad "panel/.env missing — run ./install.sh --panel"
fi

if [[ -f "${PANEL_DIR}/backend/.env" ]]; then
  perms=$(stat -c '%a' "${PANEL_DIR}/backend/.env" 2>/dev/null || echo "unknown")
  if [[ "$perms" == "600" ]]; then
    ok "panel/backend/.env permissions 600"
  else
    bad "panel/backend/.env should be chmod 600 (current: $perms)"
  fi

  if [[ -f "$PANEL_ENV" ]]; then
    panel_token=$(grep -E '^WEBINO_AGENT_TOKEN=' "$PANEL_ENV" 2>/dev/null | cut -d= -f2- || true)
    backend_token=$(grep -E '^WEBINO_AGENT_TOKEN=' "${PANEL_DIR}/backend/.env" 2>/dev/null | cut -d= -f2- || true)
    if [[ -n "$panel_token" && -n "$backend_token" && "$panel_token" != "$backend_token" ]]; then
      bad "WEBINO_AGENT_TOKEN mismatch between panel/.env and panel/backend/.env — embed signon will fail"
      echo "    Fix: copy the same token to both files; see panel/docs/AGENT_SECURITY.md"
    elif [[ -n "$panel_token" && -n "$backend_token" ]]; then
      ok "WEBINO_AGENT_TOKEN in sync (panel/.env and panel/backend/.env)"
    fi
  fi
fi

if have docker && [[ -f "$PANEL_COMPOSE" ]]; then
  if webina_compose -f "$PANEL_COMPOSE" --env-file "$PANEL_ENV" ps --status running 2>/dev/null | grep -q panel-api; then
    ok "panel-api container running"
    if webina_compose -f "$PANEL_COMPOSE" --env-file "$PANEL_ENV" exec -T panel-api test -f vendor/autoload.php 2>/dev/null; then
      ok "panel-api vendor/autoload.php present"
    else
      bad "panel-api vendor missing — check entrypoint composer install"
    fi
  else
    bad "panel-api not running — run ./install.sh --panel"
  fi

  if curl -sf --max-time 5 "http://127.0.0.1:${PANEL_HTTP_PORT}/api/v1/setup/status" >/dev/null 2>&1; then
    ok "panel API responds on :${PANEL_HTTP_PORT}/api/v1/setup/status"
  else
    bad "panel API not reachable at http://127.0.0.1:${PANEL_HTTP_PORT}/api/v1/setup/status"
  fi
fi

if [[ -f "${XDG_CONFIG_HOME:-$HOME/.config}/webina/install-path" ]]; then
  ok "install path config present"
else
  bad "install path config missing (~/.config/webina/install-path)"
fi

if [[ "$site_count" -gt 0 ]]; then
  sample_slug=$(registry_list_slugs | head -1)
  if [[ -n "$sample_slug" ]]; then
    env_file="$(site_dir "$sample_slug")/backend/.env"
    if [[ -f "$env_file" ]]; then
      perms=$(stat -c '%a' "$env_file" 2>/dev/null || echo "unknown")
      if [[ "$perms" == "600" ]]; then
        ok "sample site .env permissions 600 (${sample_slug})"
      else
        bad "sample site .env should be chmod 600 (current: $perms, site: ${sample_slug})"
      fi
    fi
  fi
fi

echo
echo "Result: ${pass} passed, ${fail} failed"
if [[ "$fail" -gt 0 ]]; then
  echo
  echo "Recovery:"
  echo "  webina                              # open control panel"
  echo "  webina platform repair              # sync compose + network + restart stack"
  echo "  docker network create ${WEBINA_NETWORK} 2>/dev/null || true"
  exit 1
fi

echo "All checks passed."
exit 0
