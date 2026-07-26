<?php

namespace Modules\Apps\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class AppsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Apps');
    }
}
