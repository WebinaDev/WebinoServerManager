<?php

namespace Modules\Cron\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hosting\Entities\HostingAccount;

class CronJob extends Model
{
    protected $fillable = [
        'schedule',
        'command',
        'task_type',
        'task_config',
        'notify_on_failure',
        'status',
        'last_error',
        'hosting_account_id',
    ];

    protected function casts(): array
    {
        return [
            'task_config' => 'array',
            'notify_on_failure' => 'boolean',
        ];
    }

    public function hostingAccount(): BelongsTo
    {
        return $this->belongsTo(HostingAccount::class, 'hosting_account_id');
    }
}
