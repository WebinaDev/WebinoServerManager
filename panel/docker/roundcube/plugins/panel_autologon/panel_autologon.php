<?php

class panel_autologon extends rcube_plugin
{
    public $task = 'login';

    public function init()
    {
        $this->add_hook('startup', [$this, 'startup']);
    }

    public function startup($args)
    {
        $ticket = rcube_utils::get_input_string('ticket', rcube_utils::INPUT_GET);
        if ($ticket === '') {
            return $args;
        }

        $token = getenv('WEBINO_AGENT_TOKEN') ?: '';
        $verifyUrl = getenv('ROUNDCUBE_VERIFY_URL') ?: 'http://panel-api:8080/api/v1/embeds/webmail/verify';
        if ($token === '') {
            return $args;
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
            return $args;
        }

        $creds = $data['data'] ?? [];
        $args['action'] = 'login';
        $_POST['_user'] = $creds['email'] ?? '';
        $_POST['_pass'] = $creds['password'] ?? '';

        return $args;
    }
}
