<?php

namespace Modules\Php\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class PhpServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Php');
    }
}
