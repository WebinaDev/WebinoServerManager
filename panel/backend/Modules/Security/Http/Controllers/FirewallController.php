<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FirewallController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/firewall');

        return response()->json($this->agentPayload($result));
    }

    public function store(Request $request): JsonResponse
    {
        $result = $this->agent->post('/v1/security/firewall', $request->all());

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function allowlist(): JsonResponse
    {
        $raw = trim((string) PanelSetting::get('api_ip_allowlist', ''));

        return response()->json([
            'allowlist' => $raw === '' ? [] : array_values(array_filter(array_map('trim', explode(',', $raw)))),
        ]);
    }

    public function updateAllowlist(Request $request): JsonResponse
    {
        $data = $request->validate([
            'allowlist' => ['nullable', 'array'],
            'allowlist.*' => ['string', 'max:64'],
        ]);

        $ips = array_values(array_filter(array_map('trim', $data['allowlist'] ?? [])));
        PanelSetting::set('api_ip_allowlist', implode(',', $ips));

        return response()->json([
            'allowlist' => $ips,
            'message' => __('security:allowlist_saved'),
        ]);
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

            return is_array($decoded) ? $decoded : ['raw' => $data];
        }

        return is_array($data) ? $data : [];
    }
}
