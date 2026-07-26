<?php

namespace Modules\Metrics\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Metrics\Console\Commands\CollectMetricsCommand;

class MetricsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Metrics');

        if ($this->app->runningInConsole()) {
            $this->commands([CollectMetricsCommand::class]);
        }
    }
}
