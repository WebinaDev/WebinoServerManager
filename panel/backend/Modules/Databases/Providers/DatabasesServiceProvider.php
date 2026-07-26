<?php

namespace Modules\Databases\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class DatabasesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Databases');
    }
}
