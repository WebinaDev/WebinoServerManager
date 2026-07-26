<?php

namespace Modules\Dns\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class DnsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Dns');
    }
}
