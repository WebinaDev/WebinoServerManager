<?php

namespace Modules\Core\Support;

use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Route;

/**
 * Load module API route files with SubstituteBindings enabled.
 *
 * Module route files declare `Route::prefix('v1')...`. Public clients (browser,
 * Caddy, OpenAPI, PHPUnit) call `/api/v1/*`. Next.js rewrites historically
 * stripped `/api` and proxied `/v1/*`. Register both so either path works.
 */
final class ModuleRoutes
{
    public static function load(string $module, string $relative = 'Routes/api.php'): void
    {
        $path = module_path($module, $relative);
        $middleware = [SubstituteBindings::class];

        // Canonical: /api/v1/*
        Route::prefix('api')->middleware($middleware)->group($path);

        // Legacy / internal: /v1/* (Next rewrite strip, docker exec probes)
        Route::middleware($middleware)->group($path);
    }
}
