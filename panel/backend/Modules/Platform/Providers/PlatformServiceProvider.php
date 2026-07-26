<?php

namespace Modules\Platform\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class PlatformServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Platform');
    }
}
