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
        'status',
        'last_error',
        'hosting_account_id',
    ];

    public function hostingAccount(): BelongsTo
    {
        return $this->belongsTo(HostingAccount::class, 'hosting_account_id');
    }
}
