<?php

namespace Modules\Files\Providers;

use Illuminate\Support\ServiceProvider;

class FilesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Files', 'Routes/api.php'));
    }
}
