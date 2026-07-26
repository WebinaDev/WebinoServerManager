<?php

namespace Modules\Apps\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Apps\Support\DecodesAgentPayload;

class NetworkController extends Controller
{
    use DecodesAgentPayload;

    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/docker/networks');
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'list failed', 'networks' => []], 422);
        }

        return response()->json($this->agentPayload($result));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/'],
        ]);
        $result = $this->agent->post('/v1/docker/networks', [
            'action' => 'create',
            'name' => $data['name'],
        ]);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'create failed'], 422);
        }

        return response()->json($this->agentPayload($result), 201);
    }

    public function destroy(string $name): JsonResponse
    {
        if (! preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/', $name)) {
            return response()->json(['message' => 'invalid name'], 422);
        }
        $result = $this->agent->post('/v1/docker/networks', [
            'action' => 'remove',
            'name' => $name,
        ]);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'remove failed'], 422);
        }

        return response()->json(['ok' => true]);
    }
}
