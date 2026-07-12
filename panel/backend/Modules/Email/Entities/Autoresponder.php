<?php

namespace Modules\Email\Entities;

use Illuminate\Database\Eloquent\Model;

class Autoresponder extends Model
{
    protected $table = 'mail_autoresponders';

    protected $fillable = [
        'address',
        'subject',
        'body',
        'enabled',
        'status',
        'last_error',
    ];

    protected function casts(): array
    {
        return ['enabled' => 'boolean'];
    }
}
