<?php

namespace Modules\Ftp\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;

class FtpServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Ftp');
    }
}
