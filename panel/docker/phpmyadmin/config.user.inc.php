<?php

declare(strict_types=1);

$cfg['Servers'][$i]['auth_type'] = 'signon';
$cfg['Servers'][$i]['SignonSession'] = 'SignonSession';
$cfg['Servers'][$i]['SignonURL'] = getenv('PMA_SIGNON_URL') ?: 'http://panel-web:3000/embed/phpmyadmin/signon.php';
$cfg['Servers'][$i]['SignonScript'] = '/var/www/html/signon.php';
$cfg['Servers'][$i]['LogoutURL'] = 'http://panel-web:3000/';
