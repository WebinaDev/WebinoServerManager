<?php

namespace Modules\Monitoring\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Monitoring\Console\Commands\CheckUptimeCommand;

class MonitoringServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Monitoring');

        if ($this->app->runningInConsole()) {
            $this->commands([CheckUptimeCommand::class]);
        }
    }
}
