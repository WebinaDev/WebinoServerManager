<?php

namespace Modules\Apps\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImageController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/docker/images');
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'agent error'], 422);
        }

        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $data = json_decode($data, true) ?? [];
        }

        return response()->json(['images' => $data['images'] ?? []]);
    }

    public function pull(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'string', 'max:255'],
        ]);

        $result = $this->agent->post('/v1/docker/images', [
            'action' => 'pull',
            'image' => $data['image'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('apps.pull_failed')], 422);
        }

        return response()->json(['message' => __('apps.pull_started'), 'agent' => $result]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'string', 'max:255'],
        ]);

        $result = $this->agent->post('/v1/docker/images', [
            'action' => 'remove',
            'image' => $data['image'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('apps.image_remove_failed')], 422);
        }

        return response()->json(['message' => __('apps.image_removed')]);
    }
}
