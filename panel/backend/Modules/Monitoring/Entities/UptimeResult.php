<?php

namespace Modules\Monitoring\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UptimeResult extends Model
{
    protected $fillable = [
        'check_id',
        'status',
        'latency_ms',
        'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'latency_ms' => 'integer',
            'checked_at' => 'datetime',
        ];
    }

    public function check(): BelongsTo
    {
        return $this->belongsTo(UptimeCheck::class, 'check_id');
    }
}
