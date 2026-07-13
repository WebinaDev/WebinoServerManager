<?php

declare(strict_types=1);

$conf['servers'][0]['desc'] = 'PostgreSQL';
$conf['servers'][0]['host'] = getenv('PHP_PG_ADMIN_SERVER_HOST') ?: 'host.docker.internal';
$conf['servers'][0]['port'] = (int) (getenv('PHP_PG_ADMIN_SERVER_PORT') ?: 5432);
$conf['servers'][0]['sslmode'] = 'allow';
$conf['servers'][0]['defaultdb'] = getenv('PHP_PG_ADMIN_SERVER_DEFAULT_DB') ?: 'template1';
$conf['servers'][0]['pg_dump_path'] = '/usr/bin/pg_dump';
$conf['servers'][0]['pg_dumpall_path'] = '/usr/bin/pg_dumpall';

$conf['default_lang'] = 'auto';
$conf['extra_login_security'] = false;
$conf['owned_only'] = false;
$conf['show_comments'] = true;
$conf['show_advanced'] = false;
$conf['show_system'] = false;
$conf['min_password_length'] = 1;
$conf['left_width'] = 200;
$conf['theme'] = 'default';
$conf['show_oids'] = false;
$conf['max_rows'] = 30;
$conf['max_chars'] = 50;
$conf['use_xhtml_strict'] = false;
$conf['help_base'] = 'http://www.postgresql.org/docs/%s/interactive/';
$conf['ajax_refresh'] = 3;
$conf['version'] = 19;
