<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class Fail2banController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/fail2ban');

        return response()->json($this->payload($result));
    }

    public function filters(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/fail2ban/filters');

        return response()->json($this->payload($result));
    }

    public function storeFilter(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9._-]+$/'],
            'content' => ['required', 'string', 'max:65535'],
            'action' => ['nullable', 'in:save,delete'],
        ]);

        $result = $this->agent->post('/v1/security/fail2ban/filters', [
            'name' => $data['name'],
            'content' => $data['content'] ?? '',
            'action' => $data['action'] ?? 'save',
        ]);

        return response()->json($this->payload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function unban(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jail' => ['required', 'string'],
            'ip' => ['required', 'string'],
        ]);
        $result = $this->agent->post('/v1/security/fail2ban', array_merge($data, ['action' => 'unban']));

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
