<?php

namespace Modules\Wordpress\Providers;

use Illuminate\Support\ServiceProvider;

class WordpressServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Wordpress', 'Routes/api.php'));
    }
}
