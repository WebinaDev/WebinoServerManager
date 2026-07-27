#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

wait_for_db() {
  local host="${DB_HOST:-db}"
  local port="${DB_PORT:-3306}"
  local user="${DB_USERNAME:-webinoserver}"
  local pass="${DB_PASSWORD:-webinoserver}"
  local db="${DB_DATABASE:-webinoserver}"
  local max=60
  local i=0
  local err=""

  export DB_HOST="$host" DB_PORT="$port" DB_USERNAME="$user" DB_PASSWORD="$pass" DB_DATABASE="$db"

  echo "[entrypoint] Waiting for database at ${host}:${port} (user=${user}, db=${db})..."
  while [[ $i -lt $max ]]; do
    err=$(
      php -r '
        $host = getenv("DB_HOST");
        $port = getenv("DB_PORT") ?: "3306";
        $user = getenv("DB_USERNAME");
        $pass = getenv("DB_PASSWORD");
        $db = getenv("DB_DATABASE");
        try {
          new PDO(
            "mysql:host={$host};port={$port};dbname={$db}",
            $user,
            $pass,
            [PDO::ATTR_TIMEOUT => 2, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
          );
          exit(0);
        } catch (Throwable $e) {
          fwrite(STDERR, $e->getMessage());
          exit(1);
        }
      ' 2>&1
    ) && {
      echo "[entrypoint] Database is ready."
      return 0
    }
    i=$((i + 1))
    if [[ $((i % 10)) -eq 0 || $i -eq 1 ]]; then
      echo "[entrypoint] DB not ready yet (${i}/${max}): ${err}" >&2
    fi
    sleep 2
  done
  echo "[entrypoint] Database not ready after ${max} attempts." >&2
  echo "[entrypoint] Last error: ${err}" >&2
  if echo "$err" | grep -qiE 'access denied|using password'; then
    echo "[entrypoint] Hint: MariaDB volume may have been initialized with a different password than panel/backend .env." >&2
    echo "[entrypoint] Fix (destroys panel DB data): docker compose --env-file panel/.env -f panel/docker-compose.panel.yml down && docker volume rm panel_panel_db_data && ./install.sh --panel" >&2
    echo "[entrypoint] Or: WEBINO_PANEL_RESET_DB=1 ./install.sh --panel" >&2
  fi
  exit 1
}

if [[ "${DB_CONNECTION:-mysql}" == "mysql" ]]; then
  wait_for_db
fi

if [[ ! -f vendor/autoload.php ]]; then
  echo "[entrypoint] Installing Composer dependencies..."
  if ! composer install --no-dev --optimize-autoloader --no-interaction 2>/tmp/composer-install.err; then
    echo "[entrypoint] composer.lock stale — running composer update..." >&2
    cat /tmp/composer-install.err >&2 || true
    composer update --no-dev --optimize-autoloader --no-interaction
  fi
fi

if [[ "${RUN_MIGRATIONS:-1}" == "1" ]]; then
  if [[ ! -f .env ]] || ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
    if [[ -z "${APP_KEY:-}" || "${APP_KEY}" == "" ]]; then
      echo "[entrypoint] Generating APP_KEY..."
      php artisan key:generate --force --no-interaction
    fi
  fi

  echo "[entrypoint] Running migrations..."
  php artisan migrate --force --no-interaction

  echo "[entrypoint] Seeding roles and permissions..."
  php artisan db:seed --class=Database\\Seeders\\RolesPermissionsSeeder --force --no-interaction

  if [[ ! -f modules_statuses.json ]]; then
    echo "[entrypoint] Enabling all modules..."
    php artisan module:enable --all --no-interaction
  else
    echo "[entrypoint] Ensuring all modules are enabled..."
    php artisan module:enable --all --no-interaction || true
  fi

  echo "[entrypoint] Clearing stale route/config caches..."
  rm -f bootstrap/cache/routes*.php bootstrap/cache/config.php 2>/dev/null || true
  php artisan route:clear --no-interaction 2>/dev/null || true
  php artisan config:clear --no-interaction 2>/dev/null || true

  echo "[entrypoint] Caching config..."
  php artisan config:cache --no-interaction
else
  echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS=0)."
  rm -f bootstrap/cache/routes*.php 2>/dev/null || true
fi

echo "[entrypoint] Starting..."
exec "$@"
