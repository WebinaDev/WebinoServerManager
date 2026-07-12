<?php

namespace Modules\Backup\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BackupTarget extends Model
{
    protected $fillable = [
        'name',
        'driver',
        'config',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'enabled' => 'boolean',
        ];
    }

    public function backups(): HasMany
    {
        return $this->hasMany(Backup::class, 'target_id');
    }

    public function resticRepo(): string
    {
        $config = $this->config ?? [];

        return match ($this->driver) {
            's3' => sprintf(
                's3:%s/%s',
                $config['endpoint'] ?? 's3.amazonaws.com',
                $config['bucket'] ?? 'webino-backups'
            ),
            'sftp' => sprintf('sftp:%s:%s', $config['host'] ?? 'localhost', $config['path'] ?? '/backups'),
            'rest' => $config['url'] ?? 'rest:https://backup.example.com',
            default => $config['repo'] ?? '',
        };
    }

    public function resticPassword(): string
    {
        return (string) (($this->config ?? [])['password'] ?? '');
    }
}
