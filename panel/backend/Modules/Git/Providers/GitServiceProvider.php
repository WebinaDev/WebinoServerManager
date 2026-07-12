<?php

namespace Modules\Git\Providers;

use Illuminate\Support\ServiceProvider;

class GitServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Git', 'Routes/api.php'));
    }
}
