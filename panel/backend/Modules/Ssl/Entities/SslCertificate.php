<?php

namespace Modules\Ssl\Entities;

use Illuminate\Database\Eloquent\Model;

class SslCertificate extends Model
{
    protected $fillable = [
        'domain',
        'type',
        'sans',
        'challenge',
        'auto_renew',
        'service_binding',
        'alert_days',
        'cert_path',
        'key_path',
        'issuer',
        'status',
        'expires_at',
        'last_error',
        'last_renewed_at',
        'last_alert_at',
    ];

    protected function casts(): array
    {
        return [
            'sans' => 'array',
            'auto_renew' => 'boolean',
            'expires_at' => 'datetime',
            'last_renewed_at' => 'datetime',
            'last_alert_at' => 'datetime',
        ];
    }
}
