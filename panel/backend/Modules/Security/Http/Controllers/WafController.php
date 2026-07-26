<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WafController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/waf');

        return response()->json($this->payload($result));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $result = $this->agent->post('/v1/security/waf', $data);

        return response()->json($this->payload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function sites(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/waf/sites');

        return response()->json($this->payload($result));
    }

    public function updateSite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:128', 'regex:/^[a-zA-Z0-9_.-]+$/'],
            'enabled' => ['required', 'boolean'],
        ]);
        $result = $this->agent->post('/v1/security/waf/sites', $data);

        return response()->json($this->payload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function logs(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/waf/sites?action=logs');

        return response()->json($this->payload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function payload(array $result): array
    {
        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);

            return is_array($decoded) ? $decoded : ['raw' => $data];
        }

        return is_array($data) ? $data : [];
    }
}
