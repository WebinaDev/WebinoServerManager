#!/usr/bin/env bash
# CI smoke test for panel docker-compose stack (Phase 29.3).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PANEL_HTTP_PORT:-2090}"

# shellcheck source=scripts/install/common.sh
source "${ROOT}/scripts/install/common.sh"

trap "${ROOT}/panel/scripts/ci-compose-down.sh" EXIT

bash "${ROOT}/panel/scripts/ci-compose-up.sh"

echo "[smoke] GET /api/v1/setup/status"
curl -sf "http://127.0.0.1:${PORT}/api/v1/setup/status" | grep -q '"data"'

echo "[smoke] GET /api/v1/auth/gate"
curl -sf "http://127.0.0.1:${PORT}/api/v1/auth/gate" | grep -q '"authenticated"'

echo "[smoke] route:list inside backend"
webina_compose --env-file "${ROOT}/panel/.env" -f "${ROOT}/panel/docker-compose.panel.yml" \
  exec -T backend php artisan route:list --path=api/v1 | head -n 5

echo "[smoke] All checks passed"
