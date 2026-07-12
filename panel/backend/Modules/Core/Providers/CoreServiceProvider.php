<?php

namespace Modules\Core\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Console\Commands\ExportOpenApiCommand;
use Modules\Core\Console\Commands\ExportRoutePermissionsCommand;
use Modules\Core\Console\Commands\ReconcileHostCommand;

class CoreServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Core', 'Routes/api.php'));

        if ($this->app->runningInConsole()) {
            $this->commands([
                ReconcileHostCommand::class,
                ExportRoutePermissionsCommand::class,
                ExportOpenApiCommand::class,
            ]);
        }
    }
}
