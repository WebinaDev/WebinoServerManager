<?php

namespace Modules\Core\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SetupStackRun extends Model
{
    protected $table = 'setup_stack_runs';

    protected $fillable = [
        'status',
        'skip',
        'config',
        'error',
    ];

    protected function casts(): array
    {
        return [
            'skip' => 'boolean',
            'config' => 'array',
        ];
    }

    public function steps(): HasMany
    {
        return $this->hasMany(SetupStackStep::class, 'run_id')->orderBy('position');
    }
}
