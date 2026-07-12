<?php

namespace Modules\Webhooks\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Rules\SafeWebhookUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Modules\Webhooks\Entities\WebhookDelivery;
use Modules\Webhooks\Entities\WebhookEndpoint;
use Modules\Webhooks\Services\WebhookDispatcher;

class WebhookController extends Controller
{
    public function __construct(private readonly WebhookDispatcher $dispatcher) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'endpoints' => WebhookEndpoint::query()->orderBy('name')->get(),
            'available_events' => WebhookDispatcher::EVENTS,
        ]);
    }

    public function deliveries(Request $request): JsonResponse
    {
        $endpointId = $request->query('endpoint_id');

        $query = WebhookDelivery::query()->orderByDesc('delivered_at')->limit(100);
        if ($endpointId) {
            $query->where('endpoint_id', $endpointId);
        }

        return response()->json(['deliveries' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'url' => ['required', 'url', 'max:512', new SafeWebhookUrl],
            'secret' => ['nullable', 'string', 'max:128'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['string', 'in:'.implode(',', WebhookDispatcher::EVENTS)],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $endpoint = WebhookEndpoint::query()->create([
            'name' => $data['name'],
            'url' => $data['url'],
            'secret' => $data['secret'] ?? Str::random(32),
            'events' => $data['events'],
            'enabled' => $data['enabled'] ?? true,
        ]);

        return response()->json(['endpoint' => $endpoint], 201);
    }

    public function update(Request $request, WebhookEndpoint $endpoint): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'url' => ['sometimes', 'url', 'max:512', new SafeWebhookUrl],
            'secret' => ['sometimes', 'string', 'max:128'],
            'events' => ['sometimes', 'array', 'min:1'],
            'events.*' => ['string', 'in:'.implode(',', WebhookDispatcher::EVENTS)],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $endpoint->update($data);

        return response()->json(['endpoint' => $endpoint->fresh()]);
    }

    public function destroy(WebhookEndpoint $endpoint): JsonResponse
    {
        $endpoint->delete();

        return response()->json(['message' => __('webhooks.deleted')]);
    }

    public function test(WebhookEndpoint $endpoint): JsonResponse
    {
        $this->dispatcher->deliver($endpoint, 'webhook.test', [
            'message' => __('webhooks.test_payload'),
            'endpoint' => $endpoint->name,
        ]);

        return response()->json(['message' => __('webhooks.test_sent')]);
    }
}
