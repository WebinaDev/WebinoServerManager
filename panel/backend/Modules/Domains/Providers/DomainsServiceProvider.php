<?php

namespace Modules\Domains\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class DomainsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Domains');
    }
}
