<?php

namespace Modules\Softstore\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SoftstorePin extends Model
{
    protected $table = 'softstore_pins';

    protected $fillable = [
        'user_id',
        'package_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SoftstorePackage::class, 'package_id');
    }
}
