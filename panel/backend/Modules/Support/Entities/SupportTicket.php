<?php

namespace Modules\Support\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    protected $fillable = [
        'subject',
        'body',
        'priority',
        'status',
        'user_id',
    ];

    public function replies(): HasMany
    {
        return $this->hasMany(SupportTicketReply::class);
    }
}
