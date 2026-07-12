<?php

namespace Modules\Apps\Providers;

use Illuminate\Support\ServiceProvider;

class AppsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Apps', 'Routes/api.php'));
    }
}
