<?php

return [
    'agent' => [
        'socket' => env('WEBINO_AGENT_SOCKET', '/run/webino-agent.sock'),
        'token' => env('WEBINO_AGENT_TOKEN', ''),
    ],
    'server_root' => env('WEBINO_SERVER_ROOT', '/opt/WebinoServer'),
    'backup_dir' => env('WEBINO_BACKUP_DIR', '/var/backups/webino'),
    'mysql_host' => env('WEBINO_MYSQL_HOST', 'host.docker.internal'),
    'pgsql_host' => env('WEBINO_PGSQL_HOST', 'host.docker.internal'),
    'imap_host' => env('WEBINO_IMAP_HOST', 'host.docker.internal:143'),
    'smtp_host' => env('WEBINO_SMTP_HOST', 'host.docker.internal:587'),
    'phpmyadmin_url' => env('WEBINO_PHPMYADMIN_URL', ''),
    'phppgadmin_url' => env('WEBINO_PHPPGADMIN_URL', ''),
    'roundcube_url' => env('WEBINO_ROUNDCUBE_URL', ''),
    'embed_ticket_ttl' => (int) env('WEBINO_EMBED_TICKET_TTL', 60),
];
