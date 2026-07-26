<?php

namespace Modules\Wordpress\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class WordpressServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Wordpress');
    }
}
