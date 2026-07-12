<?php

namespace Modules\Hosting\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HostingQuotaAlert extends Model
{
    protected $fillable = [
        'hosting_account_id',
        'resource',
        'threshold_percent',
        'enabled',
        'escalation_minutes',
        'escalation_channel',
        'breach_count',
        'last_notified_at',
    ];

    protected function casts(): array
    {
        return [
            'threshold_percent' => 'integer',
            'enabled' => 'boolean',
            'escalation_minutes' => 'integer',
            'breach_count' => 'integer',
            'last_notified_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(HostingAccount::class, 'hosting_account_id');
    }

    public function canNotify(): bool
    {
        if ($this->last_notified_at === null) {
            return true;
        }

        return $this->last_notified_at->addMinutes($this->escalation_minutes)->isPast();
    }
}
