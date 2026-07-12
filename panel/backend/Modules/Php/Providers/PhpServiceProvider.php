<?php

namespace Modules\Php\Providers;

use Illuminate\Support\ServiceProvider;

class PhpServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Php', 'Routes/api.php'));
    }
}
