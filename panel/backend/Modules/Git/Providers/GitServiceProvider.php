<?php

namespace Modules\Git\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class GitServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Git');
    }
}
