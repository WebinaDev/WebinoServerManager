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
        'net_rx_bps',
        'net_tx_bps',
        'disk_read_bps',
        'disk_write_bps',
        'collected_at',
    ];

    protected function casts(): array
    {
        return [
            'cpu_percent' => 'float',
            'mem_percent' => 'float',
            'disk_percent' => 'float',
            'load1' => 'float',
            'net_rx_bps' => 'float',
            'net_tx_bps' => 'float',
            'disk_read_bps' => 'float',
            'disk_write_bps' => 'float',
            'collected_at' => 'datetime',
        ];
    }
}
