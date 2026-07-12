<?php

namespace Modules\Email\Entities;

use Illuminate\Database\Eloquent\Model;

class MailForwarder extends Model
{
    protected $fillable = [
        'source',
        'destination',
        'status',
        'last_error',
    ];
}
