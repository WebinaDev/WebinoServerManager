<?php

namespace App\Services\Mail;

use App\Models\PanelSetting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Schema;

class PanelMailConfigurator
{
    private static function settingsAvailable(): bool
    {
        try {
            return Schema::hasTable('panel_settings');
        } catch (\Throwable) {
            return false;
        }
    }

    public static function applyFromSettings(): void
    {
        if (! self::settingsAvailable()) {
            return;
        }

        $host = PanelSetting::get('smtp_host');
        if ($host === null || $host === '') {
            return;
        }

        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.host', $host);
        Config::set('mail.mailers.smtp.port', (int) (PanelSetting::get('smtp_port', 587)));
        Config::set('mail.mailers.smtp.username', PanelSetting::get('smtp_username'));
        Config::set('mail.mailers.smtp.password', PanelSetting::get('smtp_password'));
        Config::set('mail.mailers.smtp.encryption', PanelSetting::get('smtp_encryption', 'tls'));
        Config::set('mail.from.address', PanelSetting::get('smtp_from_address', 'panel@localhost'));
        Config::set('mail.from.name', PanelSetting::get('smtp_from_name', 'WebinoServer'));
    }

    public static function isConfigured(): bool
    {
        $envMailer = config('mail.default');
        if ($envMailer === 'smtp' && config('mail.mailers.smtp.host')) {
            return true;
        }

        if (! self::settingsAvailable()) {
            return false;
        }

        $host = PanelSetting::get('smtp_host');

        return $host !== null && $host !== '';
    }
}
