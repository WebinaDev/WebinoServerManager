<?php

declare(strict_types=1);

$cfg['Servers'][1]['auth_type'] = 'signon';
$cfg['Servers'][1]['SignonSession'] = 'SignonSession';
$cfg['Servers'][1]['SignonURL'] = getenv('PMA_SIGNON_URL') ?: 'http://panel-web:3000/embed/phpmyadmin/signon.php';
$cfg['Servers'][1]['LogoutURL'] = '/';
$cfg['Servers'][1]['host'] = getenv('PMA_HOST') ?: 'host.docker.internal';
$cfg['Servers'][1]['compress'] = false;
$cfg['Servers'][1]['AllowNoPassword'] = false;
