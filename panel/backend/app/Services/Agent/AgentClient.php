<?php

namespace App\Services\Agent;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class AgentClient
{
    public function socketPath(): string
    {
        return config('webino.agent.socket', '/run/webino-agent.sock');
    }

    public function token(): string
    {
        return (string) config('webino.agent.token', '');
    }

    /**
     * @param  array<int, string>  $args
     * @return array{ok: bool, output?: string, error?: string}
     */
    public function webina(array $args): array
    {
        return $this->post('/v1/webina', ['args' => $args]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function post(string $path, array $payload = [], int $timeout = 120): array
    {
        $socket = $this->socketPath();
        if (! is_readable($socket)) {
            throw new RuntimeException('webino-agent socket not available: '.$socket);
        }

        $url = 'http://localhost'.$path;
        try {
            $pending = Http::withOptions([
                'curl' => [
                    CURLOPT_UNIX_SOCKET_PATH => $socket,
                ],
            ])->acceptJson()->timeout($timeout);

            if ($this->token() !== '') {
                $pending = $pending->withHeaders(['X-Agent-Token' => $this->token()]);
            }

            $response = $pending->post($url, $payload);
        } catch (ConnectionException $e) {
            throw new RuntimeException('webino-agent unreachable: '.$e->getMessage(), 0, $e);
        }

        $body = $response->json();
        if (! is_array($body)) {
            throw new RuntimeException('Invalid agent response');
        }

        return $body;
    }

    /**
     * @return array<string, mixed>
     */
    public function get(string $path): array
    {
        $socket = $this->socketPath();
        $url = 'http://localhost'.$path;
        $pending = Http::withOptions([
            'curl' => [CURLOPT_UNIX_SOCKET_PATH => $socket],
        ])->acceptJson()->timeout(30);

        if ($this->token() !== '') {
            $pending = $pending->withHeaders(['X-Agent-Token' => $this->token()]);
        }

        $response = $pending->get($url);
        $body = $response->json();

        return is_array($body) ? $body : [];
    }

    /**
     * @return array<string, mixed>
     */
    public function delete(string $path): array
    {
        $socket = $this->socketPath();
        $url = 'http://localhost'.$path;
        $pending = Http::withOptions([
            'curl' => [CURLOPT_UNIX_SOCKET_PATH => $socket],
        ])->acceptJson()->timeout(30);

        if ($this->token() !== '') {
            $pending = $pending->withHeaders(['X-Agent-Token' => $this->token()]);
        }

        $response = $pending->delete($url);
        $body = $response->json();

        return is_array($body) ? $body : [];
    }
}
