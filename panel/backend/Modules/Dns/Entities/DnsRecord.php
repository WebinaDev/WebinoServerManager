<?php

namespace Modules\Dns\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DnsRecord extends Model
{
    protected $fillable = [
        'zone_id',
        'type',
        'name',
        'content',
        'ttl',
        'priority',
        'status',
        'last_error',
    ];

    public function zone(): BelongsTo
    {
        return $this->belongsTo(DnsZone::class, 'zone_id');
    }
}
