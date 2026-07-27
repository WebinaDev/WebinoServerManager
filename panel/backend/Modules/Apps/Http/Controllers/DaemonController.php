<?php

namespace Modules\Apps\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Apps\Support\DecodesAgentPayload;

class DaemonController extends Controller
{
    use DecodesAgentPayload;

    public function __construct(private readonly AgentClient $agent) {}

    public function show(): JsonResponse
    {
        $result = $this->agent->get('/v1/docker/daemon');
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'read failed'], 422);
        }

        return response()->json(['daemon' => $this->agentPayload($result)]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'registry-mirrors' => ['nullable', 'array'],
            'registry-mirrors.*' => ['string', 'max:512'],
            'insecure-registries' => ['nullable', 'array'],
            'insecure-registries.*' => ['string', 'max:512'],
            'log-opts' => ['nullable', 'array'],
            'log-opts.max-size' => ['nullable', 'string', 'max:32'],
            'log-opts.max-file' => ['nullable', 'string', 'max:16'],
            'log-driver' => ['nullable', 'string', 'max:64'],
            'data-root' => ['nullable', 'string', 'max:512'],
            'live-restore' => ['nullable', 'boolean'],
        ]);

        $result = $this->agent->post('/v1/docker/daemon', $data);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'update failed'], 422);
        }

        return response()->json($this->agentPayload($result));
    }
}
