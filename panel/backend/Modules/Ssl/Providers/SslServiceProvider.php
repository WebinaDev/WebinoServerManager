<?php

namespace Modules\Ssl\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Ssl\Console\Commands\CheckSslExpiryCommand;
use Modules\Ssl\Console\Commands\RenewSslCommand;

class SslServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Ssl');

        if ($this->app->runningInConsole()) {
            $this->commands([
                RenewSslCommand::class,
                CheckSslExpiryCommand::class,
            ]);
        }
    }
}
