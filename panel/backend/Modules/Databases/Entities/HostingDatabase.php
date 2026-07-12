<?php

namespace Modules\Databases\Entities;

use Illuminate\Database\Eloquent\Model;

class HostingDatabase extends Model
{
    protected $table = 'hosting_databases';

    protected $fillable = [
        'name',
        'engine',
        'size_mb',
        'hosting_account_id',
        'db_user',
        'db_password_encrypted',
        'status',
        'last_error',
    ];

    protected $hidden = [
        'db_password_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'size_mb' => 'integer',
        ];
    }
}
