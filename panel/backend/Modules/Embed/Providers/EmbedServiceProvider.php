<?php

namespace Modules\Embed\Providers;

use Illuminate\Support\ServiceProvider;

class EmbedServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Embed', 'Routes/api.php'));
    }
}
