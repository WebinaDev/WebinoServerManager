<?php

namespace Modules\Metrics\Entities;

use Illuminate\Database\Eloquent\Model;

class MetricAlert extends Model
{
    protected $fillable = [
        'metric',
        'comparison',
        'threshold',
        'enabled',
        'channel',
        'last_triggered_at',
        'cooldown_minutes',
    ];

    protected function casts(): array
    {
        return [
            'threshold' => 'float',
            'enabled' => 'boolean',
            'last_triggered_at' => 'datetime',
            'cooldown_minutes' => 'integer',
        ];
    }

    public function isBreaching(float $value): bool
    {
        return match ($this->comparison) {
            'lt' => $value < $this->threshold,
            default => $value > $this->threshold,
        };
    }

    public function canTrigger(): bool
    {
        if (! $this->enabled) {
            return false;
        }
        if ($this->last_triggered_at === null) {
            return true;
        }

        return $this->last_triggered_at->addMinutes($this->cooldown_minutes)->isPast();
    }
}
