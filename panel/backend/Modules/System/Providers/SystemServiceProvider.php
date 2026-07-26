<?php

namespace Modules\System\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class SystemServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('System');
    }
}
