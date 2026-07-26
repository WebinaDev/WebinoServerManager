<?php

use App\Models\PanelSetting;
use App\Models\User;

if (! function_exists('module_path')) {
    function module_path(string $module, string $path = ''): string
    {
        $base = base_path('Modules/'.$module);

        return $path === '' ? $base : $base.'/'.$path;
    }
}

if (! function_exists('panel_setting')) {
    function panel_setting(string $key, mixed $default = null): mixed
    {
        return PanelSetting::get($key, $default);
    }
}

if (! function_exists('setup_completed')) {
    function setup_completed(): bool
    {
        $value = panel_setting('setup_completed', false);

        return $value === true || $value === '1' || $value === 1;
    }
}

if (! function_exists('panel_admin_exists')) {
    function panel_admin_exists(): bool
    {
        try {
            return User::role('admin')->exists();
        } catch (\Throwable) {
            return false;
        }
    }
}

if (! function_exists('needs_setup')) {
    function needs_setup(): bool
    {
        return ! (setup_completed() && panel_admin_exists());
    }
}
