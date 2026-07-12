<?php

namespace Modules\Platform\Providers;

use Illuminate\Support\ServiceProvider;

class PlatformServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Platform', 'Routes/api.php'));
    }
}
