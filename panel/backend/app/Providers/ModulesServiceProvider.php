<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\File;

class ModulesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $modulesPath = base_path('Modules');
        if (! is_dir($modulesPath)) {
            return;
        }

        foreach (File::directories($modulesPath) as $dir) {
            $manifest = $dir.'/module.json';
            if (! is_readable($manifest)) {
                continue;
            }
            $data = json_decode(file_get_contents($manifest), true);
            foreach ($data['providers'] ?? [] as $provider) {
                if (class_exists($provider)) {
                    $this->app->register($provider);
                }
            }
        }
    }
}
