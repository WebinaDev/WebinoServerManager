<?php

namespace Modules\Cron\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Cron\Console\Commands\CheckCronFailuresCommand;

class CronServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Cron');

        if ($this->app->runningInConsole()) {
            $this->commands([CheckCronFailuresCommand::class]);
        }
    }
}
