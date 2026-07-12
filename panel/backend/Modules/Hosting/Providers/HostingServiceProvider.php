<?php

namespace Modules\Hosting\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Hosting\Console\Commands\CollectHostingUsageCommand;

class HostingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Hosting', 'Routes/api.php'));

        if ($this->app->runningInConsole()) {
            $this->commands([CollectHostingUsageCommand::class]);
        }
    }
}
