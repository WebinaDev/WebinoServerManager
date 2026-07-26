<?php

namespace Modules\Support\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class SupportServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Support');
    }
}
