<?php

namespace Modules\Hosting\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HostingAccount extends Model
{
    protected $fillable = [
        'user_id',
        'plan_id',
        'username',
        'primary_domain',
        'status',
        'suspended_at',
        'suspend_reason',
        'disk_used_mb',
        'inodes_used',
        'bandwidth_used_mb',
        'last_usage_at',
    ];

    protected function casts(): array
    {
        return [
            'disk_used_mb' => 'integer',
            'inodes_used' => 'integer',
            'bandwidth_used_mb' => 'integer',
            'suspended_at' => 'datetime',
            'last_usage_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(HostingPlan::class, 'plan_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }
}
