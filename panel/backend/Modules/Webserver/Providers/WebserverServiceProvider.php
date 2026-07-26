<?php

namespace Modules\Webserver\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class WebserverServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Webserver');
    }
}
