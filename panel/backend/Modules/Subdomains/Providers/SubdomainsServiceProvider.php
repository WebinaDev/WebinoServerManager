<?php

namespace Modules\Subdomains\Providers;

use Illuminate\Support\ServiceProvider;

class SubdomainsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Subdomains', 'Routes/api.php'));
    }
}
