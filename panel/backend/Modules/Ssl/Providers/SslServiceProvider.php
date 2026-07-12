<?php

namespace Modules\Ssl\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Ssl\Console\Commands\CheckSslExpiryCommand;
use Modules\Ssl\Console\Commands\RenewSslCommand;

class SslServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Ssl', 'Routes/api.php'));

        if ($this->app->runningInConsole()) {
            $this->commands([
                RenewSslCommand::class,
                CheckSslExpiryCommand::class,
            ]);
        }
    }
}
