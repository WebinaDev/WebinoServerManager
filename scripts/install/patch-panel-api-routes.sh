#!/usr/bin/env bash
# Hot-patch panel backend routes on a running VPS (no image rebuild).
# Usage: from WebinoServerManager root: bash scripts/install/patch-panel-api-routes.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PANEL="${ROOT}/panel"
COMPOSE="${PANEL}/docker-compose.panel.yml"
ENV_FILE="${PANEL}/.env"
BACKEND_CTR="${PANEL_BACKEND_CONTAINER:-webinoserver-backend}"

if [[ ! -f "${PANEL}/backend/routes/panel-bootstrap.php" ]]; then
  echo "Missing ${PANEL}/backend/routes/panel-bootstrap.php — pull latest WebinoServerManager first." >&2
  exit 1
fi

if [[ ! -f "${PANEL}/backend/bootstrap/app.php" ]]; then
  echo "Missing bootstrap/app.php" >&2
  exit 1
fi

echo "==> Copying route bootstrap into ${BACKEND_CTR}"
docker cp "${PANEL}/backend/routes/panel-bootstrap.php" \
  "${BACKEND_CTR}:/var/www/html/routes/panel-bootstrap.php"
docker cp "${PANEL}/backend/bootstrap/app.php" \
  "${BACKEND_CTR}:/var/www/html/bootstrap/app.php"
docker cp "${PANEL}/backend/routes/api.php" \
  "${BACKEND_CTR}:/var/www/html/routes/api.php"
docker cp "${PANEL}/backend/Modules/Core/Support/ModuleRoutes.php" \
  "${BACKEND_CTR}:/var/www/html/Modules/Core/Support/ModuleRoutes.php" 2>/dev/null || true

echo "==> Clearing route/config caches (host bind mount + container)"
rm -f "${PANEL}/backend/bootstrap/cache/routes"*.php \
  "${PANEL}/backend/bootstrap/cache/config.php" 2>/dev/null || true
docker exec "${BACKEND_CTR}" sh -c \
  'rm -f bootstrap/cache/routes*.php bootstrap/cache/config.php; php artisan route:clear; php artisan config:clear' \
  || true

echo "==> Restarting PHP services"
docker restart webinoserver-backend webinoserver-worker webinoserver-scheduler

echo "==> Waiting for backend..."
for i in $(seq 1 30); do
  if docker exec webinoserver-backend curl -sf --max-time 3 http://127.0.0.1:8080/up >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Probes"
docker exec webinoserver-backend curl -sf --max-time 5 http://127.0.0.1:8080/api/v1/setup/status | head -c 400 || echo "(direct /api/v1/setup/status failed)"
echo
curl -sf --max-time 5 "http://127.0.0.1:${PANEL_HTTP_PORT:-2090}/api/v1/setup/status" | head -c 400 || echo "(edge /api/v1/setup/status failed)"
echo
docker exec webinoserver-backend php artisan route:list --path=setup 2>/dev/null | head -20 || true

echo "Done. Re-try the setup wizard."
