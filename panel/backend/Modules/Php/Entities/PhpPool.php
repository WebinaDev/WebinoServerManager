<?php

namespace Modules\Php\Entities;

use Illuminate\Database\Eloquent\Model;

class PhpPool extends Model
{
    protected $fillable = [
        'name',
        'domain',
        'php_version',
        'settings',
        'status',
        'last_error',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }
}
