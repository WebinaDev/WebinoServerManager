<?php

namespace Modules\Users\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class UsersServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Users');
    }
}
