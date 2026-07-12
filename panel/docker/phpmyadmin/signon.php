<?php

declare(strict_types=1);

session_name('SignonSession');
session_start();

$ticket = $_GET['ticket'] ?? '';
$token = getenv('WEBINO_AGENT_TOKEN') ?: '';
$verifyUrl = getenv('PMA_VERIFY_URL') ?: 'http://panel-api:8080/api/v1/embeds/phpmyadmin/verify';

if ($ticket === '' || $token === '') {
    http_response_code(403);
    exit('Forbidden');
}

$ctx = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "X-Embed-Token: {$token}\r\nAccept: application/json",
        'timeout' => 10,
    ],
]);

$response = @file_get_contents($verifyUrl.'?ticket='.urlencode($ticket), false, $ctx);
$data = is_string($response) ? json_decode($response, true) : null;

if (! is_array($data) || ! ($data['ok'] ?? false)) {
    http_response_code(403);
    exit('Invalid ticket');
}

$creds = $data['data'] ?? [];
$_SESSION['PMA_single_signon_user'] = $creds['user'] ?? '';
$_SESSION['PMA_single_signon_password'] = $creds['password'] ?? '';
$_SESSION['PMA_single_signon_host'] = $creds['host'] ?? getenv('PMA_HOST') ?: 'host.docker.internal';

session_write_close();

header('Location: index.php');
