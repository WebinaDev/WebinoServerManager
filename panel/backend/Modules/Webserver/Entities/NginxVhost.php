<?php

namespace Modules\Webserver\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Subdomains\Entities\HostingSubdomain;

class NginxVhost extends Model
{
    protected $fillable = [
        'fqdn',
        'config_name',
        'document_root',
        'php_pool',
        'ssl_enabled',
        'force_https',
        'hsts',
        'redirects',
        'proxy_rules',
        'subdomain_id',
        'engine',
        'http3',
        'status',
        'last_error',
    ];

    protected $casts = [
        'ssl_enabled' => 'boolean',
        'force_https' => 'boolean',
        'hsts' => 'boolean',
        'http3' => 'boolean',
        'redirects' => 'array',
        'proxy_rules' => 'array',
    ];

    public function subdomain(): BelongsTo
    {
        return $this->belongsTo(HostingSubdomain::class, 'subdomain_id');
    }
}
