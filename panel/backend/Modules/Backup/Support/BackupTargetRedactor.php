<?php

namespace Modules\Backup\Support;

use Modules\Backup\Entities\BackupTarget;

class BackupTargetRedactor
{
    /**
     * @return array<string, mixed>
     */
    public static function redact(BackupTarget $target): array
    {
        $data = $target->toArray();
        $config = $data['config'] ?? [];
        if (! is_array($config)) {
            return $data;
        }

        foreach (['password', 'secret', 'secret_key', 'access_key', 'key', 'token'] as $key) {
            if (array_key_exists($key, $config) && $config[$key] !== '') {
                $config[$key] = '***';
            }
        }
        $data['config'] = $config;

        return $data;
    }
}
