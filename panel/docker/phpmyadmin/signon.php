<?php

declare(strict_types=1);

session_name('SignonSession');
session_start();

$ticket = isset($_GET['ticket']) ? (string) $_GET['ticket'] : '';
if ($ticket === '') {
    http_response_code(400);
    echo 'Missing ticket';
    exit;
}

$token = getenv('WEBINO_AGENT_TOKEN') ?: '';
$verifyUrl = getenv('PMA_VERIFY_URL') ?: 'http://panel-api:8080/api/v1/embeds/phpmyadmin/verify';
if ($token === '') {
    http_response_code(503);
    echo 'Embed token not configured';
    exit;
}

$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "X-Embed-Token: {$token}\r\nAccept: application/json",
        'timeout' => 10,
    ],
]);

$response = @file_get_contents($verifyUrl.'?ticket='.rawurlencode($ticket), false, $context);
$data = is_string($response) ? json_decode($response, true) : null;

if (! is_array($data) || ! ($data['ok'] ?? false)) {
    http_response_code(403);
    echo 'Invalid or expired ticket';
    exit;
}

$creds = $data['data'] ?? [];
$_SESSION['PMA_single_signon_user'] = (string) ($creds['user'] ?? '');
$_SESSION['PMA_single_signon_password'] = (string) ($creds['password'] ?? '');
if (! empty($creds['host'])) {
    $_SESSION['PMA_single_signon_host'] = (string) $creds['host'];
}
if (! empty($creds['db'])) {
    $_SESSION['PMA_single_signon_db'] = (string) $creds['db'];
}

header('Location: index.php');
exit;
