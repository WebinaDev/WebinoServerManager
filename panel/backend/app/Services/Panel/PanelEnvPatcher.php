<?php

namespace App\Services\Panel;

use Illuminate\Support\Facades\Artisan;

class PanelEnvPatcher
{
    public function set(string $key, string $value): void
    {
        $path = base_path('.env');
        if (! is_file($path)) {
            return;
        }

        $contents = file_get_contents($path);
        if ($contents === false) {
            return;
        }

        $escaped = preg_replace('/[\\\\$]/', '\\\\$0', $value);
        $line = $key.'='.$escaped;

        if (preg_match('/^'.preg_quote($key, '/').'=/m', $contents)) {
            $contents = preg_replace('/^'.preg_quote($key, '/').'=.*$/m', $line, $contents);
        } else {
            $contents = rtrim($contents)."\n".$line."\n";
        }

        file_put_contents($path, $contents);
        @chmod($path, 0600);
    }

    public function applyHostname(string $hostname, int $port = 2090, bool $https = false): void
    {
        $scheme = $https ? 'https' : 'http';
        $host = strtolower(trim($hostname, '/'));
        $base = $port === 80 || $port === 443
            ? "{$scheme}://{$host}"
            : "{$scheme}://{$host}:{$port}";

        $domains = implode(',', array_unique([
            $host,
            "{$host}:{$port}",
            'localhost',
            "localhost:{$port}",
            '127.0.0.1',
            "127.0.0.1:{$port}",
        ]));

        $cors = implode(',', array_unique([
            $base,
            "{$scheme}://127.0.0.1:{$port}",
            "{$scheme}://localhost:{$port}",
        ]));

        $this->set('APP_URL', $base);
        $this->set('FRONTEND_URL', $base);
        $this->set('SANCTUM_STATEFUL_DOMAINS', $domains);
        $this->set('CORS_ALLOWED_ORIGINS', $cors);

        if ($https) {
            $this->set('SESSION_SECURE_COOKIE', 'true');
            $this->set('AUTH_COOKIE_SECURE', 'true');
        }

        Artisan::call('config:clear');
    }
}
