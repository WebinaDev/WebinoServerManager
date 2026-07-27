<?php

namespace Modules\Core\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Core\Console\Commands\BootstrapAdminCommand;
use Modules\Core\Console\Commands\ExportOpenApiCommand;
use Modules\Core\Console\Commands\ExportRoutePermissionsCommand;
use Modules\Core\Console\Commands\ReconcileHostCommand;

class CoreServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Core');

        if ($this->app->runningInConsole()) {
            $this->commands([
                BootstrapAdminCommand::class,
                ReconcileHostCommand::class,
                ExportRoutePermissionsCommand::class,
                ExportOpenApiCommand::class,
            ]);
        }
    }
}
