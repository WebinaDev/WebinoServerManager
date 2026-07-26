<?php

namespace Modules\Security\Providers;

use App\Models\PanelSetting;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Security\Console\Commands\ScanCommand;

class SecurityServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Security');

        if ($this->app->runningInConsole()) {
            $this->commands([ScanCommand::class]);

            $this->callAfterResolving(Schedule::class, function (Schedule $schedule) {
                $enabled = (bool) PanelSetting::get('clamav_schedule_enabled', false);
                if ($enabled) {
                    $path = PanelSetting::get('clamav_schedule_path', '/var/www');
                    $schedule->command("panel:clamav-scan {$path}")->weekly();
                }
            });
        }
    }
}
