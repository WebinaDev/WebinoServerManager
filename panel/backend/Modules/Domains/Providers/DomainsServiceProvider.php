<?php

namespace Modules\Domains\Providers;

use Illuminate\Support\ServiceProvider;

class DomainsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Domains', 'Routes/api.php'));
    }
}
