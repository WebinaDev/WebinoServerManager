<?php

namespace Modules\Embed\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class EmbedServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Embed');
    }
}
