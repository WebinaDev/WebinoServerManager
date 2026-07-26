<?php

/**
 * Allowlisted cron script library (Wave 10). Commands resolve to /usr/local/lib/webino/cron-* wrappers on the host.
 */
return [
    'backup_site' => [
        'label' => 'Backup site files',
        'script' => '/usr/local/lib/webino/cron-backup-site',
        'params' => ['target'],
    ],
    'backup_db' => [
        'label' => 'Backup database',
        'script' => '/usr/local/lib/webino/cron-backup-db',
        'params' => ['database'],
    ],
    'url_hit' => [
        'label' => 'HTTP URL ping',
        'script' => '/usr/local/lib/webino/cron-url-hit',
        'params' => ['url'],
    ],
    'log_cut' => [
        'label' => 'Rotate/truncate log',
        'script' => '/usr/local/lib/webino/cron-log-cut',
        'params' => ['path', 'keep_lines'],
    ],
];
