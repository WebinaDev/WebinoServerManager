<?php

namespace Modules\Metrics\Entities;

use Illuminate\Database\Eloquent\Model;

class MetricSample extends Model
{
    protected $fillable = [
        'cpu_percent',
        'mem_percent',
        'disk_percent',
        'load1',
        'collected_at',
    ];

    protected function casts(): array
    {
        return [
            'cpu_percent' => 'float',
            'mem_percent' => 'float',
            'disk_percent' => 'float',
            'load1' => 'float',
            'collected_at' => 'datetime',
        ];
    }
}
