<?php

namespace Modules\Backup\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Backup extends Model
{
    protected $fillable = [
        'schedule_id',
        'trigger',
        'type',
        'target',
        'filename',
        'size',
        'checksum',
        'verified_at',
        'restore_status',
        'snapshot_id',
        'target_id',
        'status',
        'last_error',
    ];

    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
        ];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(BackupSchedule::class, 'schedule_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(BackupTarget::class, 'target_id');
    }
}
