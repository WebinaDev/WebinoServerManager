<?php

namespace App\Services\Embed;

use JsonException;
use RuntimeException;

class EmbedTicketService
{
    public function ttl(): int
    {
        return max(15, (int) config('webino.embed_ticket_ttl', 60));
    }

    public function secret(): string
    {
        $secret = (string) config('webino.agent.token', '');

        if ($secret === '') {
            throw new RuntimeException('WEBINO_AGENT_TOKEN not configured');
        }

        return $secret;
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    public function issue(array $claims): string
    {
        $payload = array_merge($claims, [
            'exp' => now()->addSeconds($this->ttl())->timestamp,
        ]);

        try {
            $payloadB64 = base64_encode(json_encode($payload, JSON_THROW_ON_ERROR));
        } catch (JsonException $e) {
            throw new RuntimeException('Failed to encode ticket payload', 0, $e);
        }

        $sig = hash_hmac('sha256', $payloadB64, $this->secret());

        return $payloadB64.'.'.$sig;
    }

    /**
     * @return array<string, mixed>
     */
    public function verify(string $ticket): array
    {
        $parts = explode('.', $ticket, 2);
        if (count($parts) !== 2) {
            throw new RuntimeException('Invalid ticket format');
        }

        [$payloadB64, $sig] = $parts;
        $expected = hash_hmac('sha256', $payloadB64, $this->secret());

        if (! hash_equals($expected, $sig)) {
            throw new RuntimeException('Invalid ticket signature');
        }

        $json = base64_decode($payloadB64, true);
        if ($json === false) {
            throw new RuntimeException('Invalid ticket payload');
        }

        try {
            $payload = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('Invalid ticket JSON', 0, $e);
        }

        if (! is_array($payload)) {
            throw new RuntimeException('Invalid ticket data');
        }

        $exp = (int) ($payload['exp'] ?? 0);
        if ($exp < time()) {
            throw new RuntimeException('Ticket expired');
        }

        return $payload;
    }
}
