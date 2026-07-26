<?php

namespace Modules\Security\Entities;

use Illuminate\Database\Eloquent\Model;

class SecurityTamperWatch extends Model
{
    protected $table = 'security_tamper_watches';

    protected $fillable = [
        'path',
        'enabled',
        'last_diff_count',
        'last_scanned_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'last_scanned_at' => 'datetime',
        ];
    }
}
