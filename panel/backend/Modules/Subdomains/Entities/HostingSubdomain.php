<?php

namespace Modules\Subdomains\Entities;

use Illuminate\Database\Eloquent\Model;

class HostingSubdomain extends Model
{
    protected $table = 'hosting_subdomains';

    protected $fillable = [
        'parent_domain',
        'subdomain',
        'fqdn',
        'document_root',
        'php_pool',
        'ssl_enabled',
        'force_https',
        'status',
        'last_error',
    ];

    protected $casts = [
        'ssl_enabled' => 'boolean',
        'force_https' => 'boolean',
    ];
}
