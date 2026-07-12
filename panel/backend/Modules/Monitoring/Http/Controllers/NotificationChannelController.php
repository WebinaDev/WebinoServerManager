<?php

namespace Modules\Monitoring\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Rules\SafeOutboundUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Monitoring\Entities\NotificationChannel;
use Modules\Monitoring\Services\NotificationDispatcher;

class NotificationChannelController extends Controller
{
    public function __construct(private readonly NotificationDispatcher $dispatcher) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'channels' => NotificationChannel::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:telegram,slack,webhook,email'],
            'config' => ['required', 'array'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $this->validateChannelConfig($data['type'], $data['config']);

        $channel = NotificationChannel::query()->create([
            'name' => $data['name'],
            'type' => $data['type'],
            'config' => $data['config'],
            'enabled' => $data['enabled'] ?? true,
        ]);

        return response()->json(['channel' => $channel], 201);
    }

    public function update(Request $request, NotificationChannel $channel): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'in:telegram,slack,webhook,email'],
            'config' => ['sometimes', 'array'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $type = $data['type'] ?? $channel->type;
        if (isset($data['config'])) {
            $this->validateChannelConfig($type, $data['config']);
        }

        $channel->update($data);

        return response()->json(['channel' => $channel->fresh()]);
    }

    public function destroy(NotificationChannel $channel): JsonResponse
    {
        $channel->delete();

        return response()->json(['message' => __('monitoring.channel_deleted')]);
    }

    public function test(NotificationChannel $channel): JsonResponse
    {
        $this->dispatcher->sendTestToChannel(
            $channel,
            __('monitoring.test_subject'),
            __('monitoring.test_body', ['name' => $channel->name]),
        );

        return response()->json(['message' => __('monitoring.test_sent')]);
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function validateChannelConfig(string $type, array $config): void
    {
        match ($type) {
            'slack' => validator(['webhook_url' => $config['webhook_url'] ?? ''], [
                'webhook_url' => ['required', new SafeOutboundUrl],
            ])->validate(),
            'webhook' => validator(['url' => $config['url'] ?? ''], [
                'url' => ['required', new SafeOutboundUrl],
            ])->validate(),
            default => null,
        };
    }
}
