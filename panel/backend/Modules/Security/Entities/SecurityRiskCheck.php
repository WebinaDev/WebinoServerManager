<?php

namespace Modules\Security\Entities;

use Illuminate\Database\Eloquent\Model;

class SecurityRiskCheck extends Model
{
    protected $table = 'security_risk_checks';

    protected $fillable = [
        'check_id',
        'status',
        'fixable',
        'title',
        'detail',
        'scanned_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fixable' => 'boolean',
            'detail' => 'array',
            'scanned_at' => 'datetime',
        ];
    }
}
