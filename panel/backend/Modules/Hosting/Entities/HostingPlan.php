<?php

namespace Modules\Hosting\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HostingPlan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'disk_mb',
        'bandwidth_mb',
        'inodes',
        'max_domains',
        'max_subdomains',
        'max_databases',
        'max_mailboxes',
        'max_ftp',
        'max_cron',
        'price',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'disk_mb' => 'integer',
            'bandwidth_mb' => 'integer',
            'inodes' => 'integer',
            'max_domains' => 'integer',
            'max_subdomains' => 'integer',
            'max_databases' => 'integer',
            'max_mailboxes' => 'integer',
            'max_ftp' => 'integer',
            'max_cron' => 'integer',
            'price' => 'decimal:2',
            'enabled' => 'boolean',
        ];
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(HostingAccount::class, 'plan_id');
    }
}
