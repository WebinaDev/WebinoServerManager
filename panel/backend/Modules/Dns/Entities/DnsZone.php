<?php

namespace Modules\Dns\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DnsZone extends Model
{
    protected $fillable = [
        'domain',
        'zone_kind',
        'master_ns',
        'dnssec_enabled',
        'template',
        'status',
        'last_error',
    ];

    protected $casts = [
        'dnssec_enabled' => 'boolean',
    ];

    public function records(): HasMany
    {
        return $this->hasMany(DnsRecord::class, 'zone_id');
    }
}
