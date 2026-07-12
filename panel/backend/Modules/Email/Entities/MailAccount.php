<?php

namespace Modules\Email\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MailAccount extends Model
{
    protected $fillable = [
        'mail_domain_id',
        'address',
        'password_encrypted',
        'quota_mb',
        'status',
        'last_error',
    ];

    protected $hidden = ['password_encrypted'];

    public function mailDomain(): BelongsTo
    {
        return $this->belongsTo(MailDomain::class, 'mail_domain_id');
    }
}
