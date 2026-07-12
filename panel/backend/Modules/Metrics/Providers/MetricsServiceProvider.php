<?php

namespace Modules\Metrics\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Metrics\Console\Commands\CollectMetricsCommand;

class MetricsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Metrics', 'Routes/api.php'));

        if ($this->app->runningInConsole()) {
            $this->commands([CollectMetricsCommand::class]);
        }
    }
}
