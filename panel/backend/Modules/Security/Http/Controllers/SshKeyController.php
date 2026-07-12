<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SshKeyController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/sshkeys');

        return response()->json($this->payload($result));
    }

    public function store(Request $request): JsonResponse
    {
        $result = $this->agent->post('/v1/security/sshkeys', $request->all());

        return response()->json($this->payload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function payload(array $result): array
    {
        $data = $result['data'] ?? [];

        return is_array($data) ? $data : [];
    }
}
