<?php

$config['plugins'] = array_merge($config['plugins'] ?? [], ['panel_autologon']);

$config['imap_host'] = getenv('ROUNDCUBE_IMAP_HOST') ?: 'host.docker.internal:143';
$config['smtp_host'] = getenv('ROUNDCUBE_SMTP_HOST') ?: 'host.docker.internal:587';
$config['des_key'] = getenv('ROUNDCUBE_DES_KEY') ?: 'panel-roundcube-des-key-change-me';
$config['enable_installer'] = false;
$config['auto_create_user'] = true;
