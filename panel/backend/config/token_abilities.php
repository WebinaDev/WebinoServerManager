<?php

return [

    /*
    |--------------------------------------------------------------------------
    | API token route allowlist
    |--------------------------------------------------------------------------
    | Paths reachable with only the base "read" ability (session self-service).
    */
    'allowlist' => [
        'api/v1/auth/check',
        'api/v1/auth/user',
        'api/v1/auth/profile',
        'api/v1/auth/logout',
        'api/v1/auth/password',
        'api/v1/navigation',
        'api/v1/setup/status',
        'api/v1/dashboard/summary',
        'api/v1/metrics/current',
    ],

    /*
    |--------------------------------------------------------------------------
    | Longest-prefix match → required Sanctum ability
    |--------------------------------------------------------------------------
    */
    'prefixes' => [
        'api/v1/domains' => 'domains.manage',
        'api/v1/databases' => 'databases.manage',
        'api/v1/subdomains' => 'domains.manage',
        'api/v1/dns' => 'system.manage',
        'api/v1/ssl' => 'system.manage',
        'api/v1/ftp' => 'system.manage',
        'api/v1/php' => 'system.manage',
        'api/v1/email' => 'system.manage',
        'api/v1/mail' => 'system.manage',
        'api/v1/files' => 'system.manage',
        'api/v1/cron' => 'system.manage',
        'api/v1/backups' => 'system.manage',
        'api/v1/system' => 'system.manage',
        'api/v1/metrics' => 'system.manage',
        'api/v1/terminal' => 'system.manage',
        'api/v1/git' => 'system.manage',
        'api/v1/wordpress' => 'system.manage',
        'api/v1/support' => 'system.manage',
        'api/v1/sites' => 'platform.manage',
        'api/v1/products' => 'platform.manage',
        'api/v1/hosting' => 'hosting.manage',
        'api/v1/apps' => 'apps.manage',
        'api/v1/monitoring' => 'monitoring.manage',
        'api/v1/security' => 'security.manage',
        'api/v1/webhooks' => 'webhooks.manage',
        'api/v1/auth/tokens' => 'tokens.manage',
        'api/v1/webserver' => 'system.manage',
        'api/v1/embeds/phppgadmin' => 'embed.phppgadmin',
        'api/v1/embeds/phpmyadmin' => 'embed.phpmyadmin',
        'api/v1/embeds/webmail' => 'embed.webmail',
        'api/v1/embeds' => 'embed.phpmyadmin',
        'api/v1/users' => 'users.manage',
        'api/v1/setup' => 'users.manage',
    ],

];
