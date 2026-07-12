<?php

namespace Modules\Monitoring\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/services');
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'agent error'], 422);
        }

        $data = $this->agentPayload($result);

        return response()->json(['services' => $data['services'] ?? []]);
    }

    public function action(Request $request): JsonResponse
    {
        $data = $request->validate([
            'service' => ['required', 'string', 'max:64'],
            'action' => ['required', 'in:start,stop,restart'],
        ]);

        $result = $this->agent->post('/v1/services', $data);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('monitoring.service_action_failed')], 422);
        }

        return response()->json(['agent' => $this->agentPayload($result)]);
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function agentPayload(array $result): array
    {
        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($data) ? $data : [];
    }
}
