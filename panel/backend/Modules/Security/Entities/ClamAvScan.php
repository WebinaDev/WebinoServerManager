<?php

namespace Modules\Security\Entities;

use Illuminate\Database\Eloquent\Model;

class ClamAvScan extends Model
{
    public $timestamps = false;

    protected $table = 'clamav_scans';

    protected $fillable = [
        'path',
        'status',
        'infected_json',
        'started_at',
        'finished_at',
        'error',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'infected_json' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }
}
