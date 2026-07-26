<?php

namespace Modules\Products\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class ProductsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Products');
    }
}
