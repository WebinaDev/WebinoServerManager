<?php

namespace Modules\Backup\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BackupSchedule extends Model
{
    protected $fillable = [
        'name',
        'type',
        'target',
        'frequency',
        'retention_days',
        'target_id',
        'mode',
        'enabled',
        'last_run_at',
        'next_run_at',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'retention_days' => 'integer',
            'last_run_at' => 'datetime',
            'next_run_at' => 'datetime',
        ];
    }

    public function backups(): HasMany
    {
        return $this->hasMany(Backup::class, 'schedule_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(BackupTarget::class, 'target_id');
    }

    public function computeNextRunAt(): \Carbon\Carbon
    {
        return match ($this->frequency) {
            'hourly' => now()->addHour(),
            'weekly' => now()->addWeek(),
            default => now()->addDay(),
        };
    }

    public function isDue(): bool
    {
        if (! $this->enabled) {
            return false;
        }
        if ($this->next_run_at === null) {
            return true;
        }

        return $this->next_run_at->isPast();
    }
}
