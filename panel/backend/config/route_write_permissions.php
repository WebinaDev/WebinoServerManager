<?php

/**
 * Permission required for create/update/delete UI on read-open routes.
 * Keep in sync with panel/frontend/src/lib/routeWritePermissions.ts
 */
return [
    '/websites' => 'domains.manage',
    '/domains' => 'domains.manage',
    '/subdomains' => 'domains.manage',
    '/databases' => 'databases.manage',
    '/dns' => 'system.manage',
    '/ssl' => 'system.manage',
    '/ftp' => 'system.manage',
    '/php-settings' => 'system.manage',
    '/email/domains' => 'system.manage',
    '/email/auth' => 'system.manage',
    '/email/accounts' => 'system.manage',
    '/email/forwarders' => 'system.manage',
    '/email/autoresponders' => 'system.manage',
    '/email/lists' => 'system.manage',
    '/email/antispam' => 'system.manage',
    '/backups' => 'system.manage',
    '/settings' => 'system.manage',
    '/metrics-alerts' => 'system.manage',
    '/git' => 'system.manage',
    '/wordpress' => 'system.manage',
    '/support' => 'system.manage',
    '/apps' => 'apps.manage',
    '/softstore' => 'system.manage',
    '/runtimes' => 'system.manage',
    '/sites' => 'platform.manage',
    '/products' => 'platform.manage',
];
