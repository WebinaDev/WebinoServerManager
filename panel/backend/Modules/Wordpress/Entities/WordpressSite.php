<?php

namespace Modules\Wordpress\Entities;

use Illuminate\Database\Eloquent\Model;

class WordpressSite extends Model
{
    protected $fillable = [
        'domain',
        'path',
        'title',
        'admin_user',
        'admin_password_encrypted',
        'admin_email',
        'status',
        'last_error',
    ];

    protected $hidden = [
        'admin_password_encrypted',
    ];
}
