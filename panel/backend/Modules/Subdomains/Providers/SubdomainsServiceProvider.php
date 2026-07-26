<?php

namespace Modules\Subdomains\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class SubdomainsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Subdomains');
    }
}
