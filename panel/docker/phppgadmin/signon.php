<?php

declare(strict_types=1);

$ticket = $_GET['ticket'] ?? '';
$token = getenv('WEBINO_AGENT_TOKEN') ?: '';
$verifyUrl = getenv('PPA_VERIFY_URL') ?: 'http://panel-api:8080/api/v1/embeds/phppgadmin/verify';

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
$user = (string) ($creds['user'] ?? '');
$password = (string) ($creds['password'] ?? '');
$server = (string) ($creds['host'] ?? getenv('PHP_PG_ADMIN_SERVER_HOST') ?: 'host.docker.internal');
$db = (string) ($creds['db'] ?? '');

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Signing in…</title>
</head>
<body>
<form id="login" method="post" action="login.php">
    <input type="hidden" name="loginUsername" value="<?= htmlspecialchars($user, ENT_QUOTES, 'UTF-8') ?>">
    <input type="hidden" name="loginPassword" value="<?= htmlspecialchars($password, ENT_QUOTES, 'UTF-8') ?>">
    <input type="hidden" name="loginServer" value="0">
    <?php if ($db !== '') { ?>
    <input type="hidden" name="loginDatabase" value="<?= htmlspecialchars($db, ENT_QUOTES, 'UTF-8') ?>">
    <?php } ?>
</form>
<script>document.getElementById('login').submit();</script>
</body>
</html>
