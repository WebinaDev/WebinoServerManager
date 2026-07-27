<?php

namespace Modules\Websites\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Ftp\Entities\FtpAccount;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Webserver\Entities\NginxVhost;

class HostingWebsite extends Model
{
    protected $table = 'hosting_websites';

    protected $fillable = [
        'hosting_account_id',
        'fqdn',
        'aliases',
        'type',
        'engine',
        'document_root',
        'php_pool',
        'php_version',
        'ssl_enabled',
        'force_https',
        'hsts',
        'http3',
        'hotlink_protect',
        'rewrite_template',
        'rewrite_custom',
        'deny_paths',
        'auth_entries',
        'traffic_limit_mb',
        'proxy_pass',
        'vhost_id',
        'ftp_account_id',
        'database_id',
        'status',
        'last_error',
    ];

    protected $casts = [
        'aliases' => 'array',
        'deny_paths' => 'array',
        'auth_entries' => 'array',
        'ssl_enabled' => 'boolean',
        'force_https' => 'boolean',
        'hsts' => 'boolean',
        'http3' => 'boolean',
        'hotlink_protect' => 'boolean',
        'traffic_limit_mb' => 'integer',
    ];

    public function hostingAccount(): BelongsTo
    {
        return $this->belongsTo(HostingAccount::class, 'hosting_account_id');
    }

    public function vhost(): BelongsTo
    {
        return $this->belongsTo(NginxVhost::class, 'vhost_id');
    }

    public function ftpAccount(): BelongsTo
    {
        return $this->belongsTo(FtpAccount::class, 'ftp_account_id');
    }

    public function database(): BelongsTo
    {
        return $this->belongsTo(HostingDatabase::class, 'database_id');
    }

    public function configName(): string
    {
        return str_replace('.', '_', $this->fqdn);
    }
}
