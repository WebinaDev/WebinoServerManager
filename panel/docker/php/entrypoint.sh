#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

wait_for_db() {
  local host="${DB_HOST:-panel-db}"
  local port="${DB_PORT:-3306}"
  local user="${DB_USERNAME:-webinoserver}"
  local pass="${DB_PASSWORD:-webinoserver}"
  local db="${DB_DATABASE:-webinoserver}"
  local max=60
  local i=0

  echo "[entrypoint] Waiting for database at ${host}:${port}..."
  while [[ $i -lt $max ]]; do
    if php -r "
      try {
        new PDO(
          'mysql:host=${host};port=${port};dbname=${db}',
          '${user}',
          '${pass}',
          [PDO::ATTR_TIMEOUT => 2]
        );
        exit(0);
      } catch (Throwable \$e) {
        exit(1);
      }
    "; then
      echo "[entrypoint] Database is ready."
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  echo "[entrypoint] Database not ready after ${max} attempts." >&2
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
  if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
    if [[ -z "${APP_KEY:-}" ]] || [[ "${APP_KEY}" == "" ]]; then
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

  echo "[entrypoint] Caching config..."
  php artisan config:cache --no-interaction
else
  echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS=0)."
fi

echo "[entrypoint] Starting..."
exec "$@"
