<?php

namespace Modules\Backup\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Backup\Console\Commands\RunScheduledBackupsCommand;

class BackupServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Backup');

        if ($this->app->runningInConsole()) {
            $this->commands([RunScheduledBackupsCommand::class]);
        }
    }
}
