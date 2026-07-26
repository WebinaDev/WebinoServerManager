<?php

namespace Modules\Core\Support;

use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Route;

/**
 * Load module API route files with SubstituteBindings enabled.
 * Module routes are not in Laravel's "api" group, so bindings must be applied explicitly.
 */
final class ModuleRoutes
{
    public static function load(string $module, string $relative = 'Routes/api.php'): void
    {
        Route::middleware([SubstituteBindings::class])->group(module_path($module, $relative));
    }
}
