<?php

namespace Modules\Monitoring\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UptimeCheck extends Model
{
    protected $fillable = [
        'name',
        'target',
        'type',
        'interval_minutes',
        'enabled',
        'last_status',
        'last_checked_at',
        'last_latency_ms',
    ];

    protected function casts(): array
    {
        return [
            'interval_minutes' => 'integer',
            'enabled' => 'boolean',
            'last_checked_at' => 'datetime',
            'last_latency_ms' => 'integer',
        ];
    }

    public function results(): HasMany
    {
        return $this->hasMany(UptimeResult::class, 'check_id');
    }
}
