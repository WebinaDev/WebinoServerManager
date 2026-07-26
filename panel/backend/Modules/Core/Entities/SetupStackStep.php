<?php

namespace Modules\Core\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SetupStackStep extends Model
{
    protected $table = 'setup_stack_steps';

    protected $fillable = [
        'run_id',
        'position',
        'slug',
        'script_id',
        'label',
        'status',
        'log',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(SetupStackRun::class, 'run_id');
    }
}
