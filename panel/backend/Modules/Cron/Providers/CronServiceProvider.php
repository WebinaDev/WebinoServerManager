<?php

namespace Modules\Cron\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Cron\Console\Commands\CheckCronFailuresCommand;

class CronServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Cron', 'Routes/api.php'));

        if ($this->app->runningInConsole()) {
            $this->commands([CheckCronFailuresCommand::class]);
        }
    }
}
