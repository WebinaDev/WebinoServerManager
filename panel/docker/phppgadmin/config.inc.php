<?php

declare(strict_types=1);

$conf['servers'][0]['host'] = getenv('PHP_PG_ADMIN_SERVER_HOST') ?: 'host.docker.internal';
$conf['servers'][0]['port'] = (int) (getenv('PHP_PG_ADMIN_SERVER_PORT') ?: 5432);
$conf['servers'][0]['sslmode'] = 'allow';
$conf['servers'][0]['defaultdb'] = 'postgres';

$conf['extra_login_security'] = false;
$conf['owned_only'] = true;

$conf['servers'][0]['logout_url'] = 'http://panel-web:3000/';
