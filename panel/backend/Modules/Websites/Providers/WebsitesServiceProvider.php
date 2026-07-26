<?php

namespace Modules\Websites\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class WebsitesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Websites');
    }
}
