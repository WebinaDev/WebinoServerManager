<?php

namespace Modules\Dns\Providers;

use Illuminate\Support\ServiceProvider;

class DnsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Dns', 'Routes/api.php'));
    }
}
