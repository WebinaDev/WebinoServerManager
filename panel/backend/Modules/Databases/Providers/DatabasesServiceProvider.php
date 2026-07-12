<?php

namespace Modules\Databases\Providers;

use Illuminate\Support\ServiceProvider;

class DatabasesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Databases', 'Routes/api.php'));
    }
}
