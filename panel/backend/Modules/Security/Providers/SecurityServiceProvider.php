<?php

namespace Modules\Security\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Security\Console\Commands\ScanCommand;

class SecurityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Security', 'Routes/api.php'));

        if ($this->app->runningInConsole()) {
            $this->commands([ScanCommand::class]);
        }
    }
}
