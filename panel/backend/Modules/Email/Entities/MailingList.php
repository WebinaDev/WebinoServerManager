<?php

namespace Modules\Email\Entities;

use Illuminate\Database\Eloquent\Model;

class MailingList extends Model
{
    protected $fillable = [
        'source',
        'destinations',
        'status',
        'last_error',
    ];

    protected function casts(): array
    {
        return ['destinations' => 'array'];
    }
}
