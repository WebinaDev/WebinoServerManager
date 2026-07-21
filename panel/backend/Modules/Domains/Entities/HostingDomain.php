<?php

namespace Modules\Domains\Entities;

use Illuminate\Database\Eloquent\Model;

class HostingDomain extends Model
{
    protected $table = 'hosting_domains';

    protected $fillable = [
        'hosting_account_id',
        'domain',
        'slug',
        'aliases',
        'status',
        'last_error',
    ];
}
