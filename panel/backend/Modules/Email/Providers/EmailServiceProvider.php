<?php

namespace Modules\Email\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class EmailServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Email');
    }
}
