<?php

namespace Modules\Dns\Entities;

use Illuminate\Database\Eloquent\Model;

class DnsProvider extends Model
{
    protected $fillable = [
        'provider',
        'api_token_encrypted',
        'default_zone_id',
        'enabled',
    ];

    protected $hidden = [
        'api_token_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
        ];
    }

    public function setApiTokenAttribute(?string $token): void
    {
        $this->attributes['api_token_encrypted'] = $token !== null && $token !== ''
            ? encrypt($token)
            : null;
    }

    public function getHasTokenAttribute(): bool
    {
        return ! empty($this->attributes['api_token_encrypted']);
    }
}
