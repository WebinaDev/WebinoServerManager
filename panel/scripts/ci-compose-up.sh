#!/usr/bin/env bash
# Start panel stack for CI (Phase 29.3 / 29.4).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PANEL_DIR="${ROOT}/panel"
PANEL_ENV="${PANEL_DIR}/.env"
COMPOSE_FILE="${PANEL_DIR}/docker-compose.panel.yml"
export PANEL_HTTP_PORT="${PANEL_HTTP_PORT:-2090}"

# shellcheck source=scripts/install/common.sh
source "${ROOT}/scripts/install/common.sh"
# shellcheck source=scripts/install/panel-secrets.sh
source "${ROOT}/scripts/install/panel-secrets.sh"

docker network inspect webino_platform >/dev/null 2>&1 || docker network create webino_platform

generate_panel_secrets "${PANEL_DIR}" 1

webina_compose --env-file "${PANEL_ENV}" -f "${COMPOSE_FILE}" up -d --build \
  db redis backend agent frontend

wait_for_panel_api "${COMPOSE_FILE}" "${PANEL_ENV}" 60 || exit 1
