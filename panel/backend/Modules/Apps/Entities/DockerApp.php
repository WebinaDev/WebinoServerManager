<?php

namespace Modules\Apps\Entities;

use Illuminate\Database\Eloquent\Model;

class DockerApp extends Model
{
    protected $table = 'docker_apps';

    protected $fillable = [
        'name',
        'image',
        'container_id',
        'ports',
        'env_encrypted',
        'volumes',
        'restart_policy',
        'proxy_domain',
        'proxy_port',
        'hosting_account_id',
        'status',
        'last_error',
    ];

    protected $hidden = [
        'env_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'ports' => 'array',
            'volumes' => 'array',
            'proxy_port' => 'integer',
        ];
    }
}
