<?php

namespace Modules\Ftp\Entities;

use Illuminate\Database\Eloquent\Model;

class FtpAccount extends Model
{
    protected $fillable = [
        'username',
        'home_dir',
        'domain',
        'status',
        'last_error',
    ];
}
