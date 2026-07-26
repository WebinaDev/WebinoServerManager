<?php

namespace Modules\System\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/system/info');

        if (! ($result['ok'] ?? false)) {
            return response()->json([
                'message' => $result['error'] ?? __('system.fetch_failed'),
            ], 422);
        }

        return response()->json(['info' => $this->decode($result)]);
    }

    public function disk(): JsonResponse
    {
        $result = $this->agent->get('/v1/system/disk');

        if (! ($result['ok'] ?? false)) {
            return response()->json([
                'message' => $result['error'] ?? __('system.fetch_failed'),
            ], 422);
        }

        return response()->json($this->decode($result));
    }

    public function diskCleanup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:256'],
        ]);

        $result = $this->agent->post('/v1/system/disk', [
            'action' => 'cleanup',
            'path' => $data['path'],
        ]);

        return response()->json($this->decode($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function decode(array $result): array
    {
        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);

            return is_array($decoded) ? $decoded : ['raw' => $data];
        }

        return is_array($data) ? $data : [];
    }
}
