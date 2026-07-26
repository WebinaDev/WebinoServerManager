<?php

namespace Modules\Files\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class FilesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Files');
    }
}
