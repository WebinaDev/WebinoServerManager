#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT}/panel/docker-compose.panel.yml"
BACKEND_ENV="${ROOT}/panel/backend/.env"

# shellcheck source=scripts/install/common.sh
source "${ROOT}/scripts/install/common.sh"

webina_compose --env-file "${BACKEND_ENV}" -f "${COMPOSE_FILE}" down -v --remove-orphans 2>/dev/null || true
