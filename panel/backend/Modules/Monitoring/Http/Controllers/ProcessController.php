<?php

namespace Modules\Monitoring\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcessController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(Request $request): JsonResponse
    {
        $limit = min(50, max(1, (int) $request->query('limit', 20)));
        $result = $this->agent->get('/v1/system/processes?limit='.$limit);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'list failed', 'processes' => []], 422);
        }

        return response()->json($this->agentPayload($result));
    }

    public function kill(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pid' => ['required', 'integer', 'min:2'],
            'signal' => ['nullable', 'in:TERM,KILL'],
        ]);
        $result = $this->agent->post('/v1/system/processes', [
            'action' => 'kill',
            'pid' => $data['pid'],
            'signal' => $data['signal'] ?? 'TERM',
        ]);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'kill failed'], 422);
        }

        return response()->json($this->agentPayload($result));
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
