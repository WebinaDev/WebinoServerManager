<?php

namespace Modules\Backup\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Backup\Console\Commands\RunScheduledBackupsCommand;

class BackupServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Backup', 'Routes/api.php'));

        if ($this->app->runningInConsole()) {
            $this->commands([RunScheduledBackupsCommand::class]);
        }
    }
}
