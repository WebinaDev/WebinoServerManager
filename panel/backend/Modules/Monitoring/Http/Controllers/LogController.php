<?php

namespace Modules\Monitoring\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function sources(): JsonResponse
    {
        $result = $this->agent->get('/v1/logs');
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'agent error'], 422);
        }

        $data = $this->agentPayload($result);

        return response()->json(['sources' => $data['sources'] ?? []]);
    }

    public function tail(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source' => ['required', 'string', 'max:64'],
            'lines' => ['nullable', 'integer', 'min:1', 'max:5000'],
        ]);

        $lines = $data['lines'] ?? 100;
        $result = $this->agent->get('/v1/logs?source='.urlencode($data['source']).'&lines='.$lines);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('monitoring.logs_failed')], 422);
        }

        return response()->json(['log' => $this->agentPayload($result)]);
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
