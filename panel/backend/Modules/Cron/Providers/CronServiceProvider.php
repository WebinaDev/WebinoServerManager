<?php

namespace Modules\Cron\Providers;

use Illuminate\Support\ServiceProvider;

class CronServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Cron', 'Routes/api.php'));
    }
}
