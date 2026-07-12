<?php

namespace Modules\Databases\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DatabaseUser extends Model
{
    protected $fillable = [
        'username',
        'host',
        'engine',
        'database_id',
        'hosting_account_id',
    ];

    public function database(): BelongsTo
    {
        return $this->belongsTo(HostingDatabase::class, 'database_id');
    }
}
