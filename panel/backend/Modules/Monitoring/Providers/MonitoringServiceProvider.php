<?php

namespace Modules\Monitoring\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Monitoring\Console\Commands\CheckUptimeCommand;

class MonitoringServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Monitoring', 'Routes/api.php'));

        if ($this->app->runningInConsole()) {
            $this->commands([CheckUptimeCommand::class]);
        }
    }
}
