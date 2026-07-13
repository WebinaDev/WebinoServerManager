<?php

declare(strict_types=1);

$_no_db_connection = true;

$ticket = isset($_GET['ticket']) ? (string) $_GET['ticket'] : '';
if ($ticket === '') {
    http_response_code(400);
    echo 'Missing ticket';
    exit;
}

$token = getenv('WEBINO_AGENT_TOKEN') ?: '';
$verifyUrl = getenv('PPA_VERIFY_URL') ?: 'http://panel-api:8080/api/v1/embeds/phppgadmin/verify';
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
require_once __DIR__.'/libraries/lib.inc.php';

$serverId = 0;
$info = $misc->getServerInfo($serverId);
$info['username'] = (string) ($creds['user'] ?? '');
$info['password'] = (string) ($creds['password'] ?? '');
$misc->setServerInfo(null, $info, $serverId);

$database = (string) ($creds['db'] ?? ($info['defaultdb'] ?? 'template1'));
header('Location: redirect.php?subject=database&server='.$serverId.'&database='.rawurlencode($database));
exit;
