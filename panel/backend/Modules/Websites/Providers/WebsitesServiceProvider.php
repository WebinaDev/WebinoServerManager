<?php

namespace Modules\Websites\Providers;

use Illuminate\Support\ServiceProvider;

class WebsitesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Websites', 'Routes/api.php'));
    }
}
