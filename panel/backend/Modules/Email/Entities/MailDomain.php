<?php

namespace Modules\Email\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MailDomain extends Model
{
    protected $fillable = ['domain', 'status', 'last_error', 'catch_all', 'dkim_selector', 'dkim_public_key'];

    public function accounts(): HasMany
    {
        return $this->hasMany(MailAccount::class, 'mail_domain_id');
    }
}
