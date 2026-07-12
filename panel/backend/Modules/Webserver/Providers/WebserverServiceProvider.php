<?php

namespace Modules\Webserver\Providers;

use Illuminate\Support\ServiceProvider;

class WebserverServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Webserver', 'Routes/api.php'));
    }
}
