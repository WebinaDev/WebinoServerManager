<?php

namespace Modules\Ftp\Entities;

use Illuminate\Database\Eloquent\Model;

class FtpAccount extends Model
{
    protected $fillable = [
        'username',
        'home_dir',
        'domain',
        'quota_mb',
        'enabled',
        'status',
        'last_error',
    ];

    protected function casts(): array
    {
        return [
            'quota_mb' => 'integer',
            'enabled' => 'boolean',
        ];
    }
}
