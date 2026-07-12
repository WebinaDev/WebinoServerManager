<?php

namespace Modules\Ftp\Providers;

use Illuminate\Support\ServiceProvider;

class FtpServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Ftp', 'Routes/api.php'));
    }
}
