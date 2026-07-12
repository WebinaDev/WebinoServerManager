<?php

namespace Modules\Webhooks\Services;

use App\Models\PanelSetting;
use App\Services\Security\OutboundUrlGuard;
use Illuminate\Support\Facades\Http;
use Modules\Webhooks\Entities\WebhookDelivery;
use Modules\Webhooks\Entities\WebhookEndpoint;

class WebhookDispatcher
{
    public const EVENTS = [
        'backup.completed',
        'ssl.expiring',
        'alert.fired',
        'user.created',
        'site.created',
        'site.ready',
        'site.failed',
        'ssl.pending',
        'ssl.active',
    ];

    /**
     * @param  array<string, mixed>  $payload
     */
    public function dispatch(string $event, array $payload): void
    {
        $endpoints = WebhookEndpoint::query()
            ->where('enabled', true)
            ->get()
            ->filter(fn (WebhookEndpoint $ep) => in_array($event, $ep->events ?? [], true));

        foreach ($endpoints as $endpoint) {
            $this->deliver($endpoint, $event, $payload);
        }

        $this->pruneDeliveries();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function deliver(WebhookEndpoint $endpoint, string $event, array $payload): void
    {
        $body = [
            'event' => $event,
            'payload' => $payload,
            'timestamp' => now()->toIso8601String(),
        ];
        $json = json_encode($body, JSON_THROW_ON_ERROR);
        $signature = hash_hmac('sha256', $json, $endpoint->secret);

        $status = 'failed';
        $code = null;

        try {
            OutboundUrlGuard::assertSafeHttpUrl($endpoint->url);
            $response = Http::timeout(15)
                ->withHeaders(['X-Webino-Signature' => $signature])
                ->withBody($json, 'application/json')
                ->post($endpoint->url);
            $code = $response->status();
            $status = $response->successful() ? 'success' : 'failed';
        } catch (\Throwable) {
            $status = 'failed';
        }

        WebhookDelivery::query()->create([
            'endpoint_id' => $endpoint->id,
            'event' => $event,
            'status' => $status,
            'response_code' => $code,
            'payload' => $body,
            'delivered_at' => now(),
        ]);

        $endpoint->update([
            'last_status' => $status,
            'last_delivered_at' => now(),
        ]);
    }

    private function pruneDeliveries(): void
    {
        $days = (int) PanelSetting::get('webhook_delivery_retention_days', 14);
        WebhookDelivery::query()
            ->where('delivered_at', '<', now()->subDays($days))
            ->delete();
    }
}
