<?php

namespace Modules\Hosting\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Hosting\Console\Commands\CollectHostingUsageCommand;

class HostingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Hosting');

        if ($this->app->runningInConsole()) {
            $this->commands([CollectHostingUsageCommand::class]);
        }
    }
}
