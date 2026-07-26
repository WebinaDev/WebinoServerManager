<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Security\Entities\SecurityRiskCheck;

class RiskController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/risks');
        $payload = $this->agentPayload($result);
        $checks = $payload['checks'] ?? [];

        if (is_array($checks)) {
            foreach ($checks as $check) {
                if (! is_array($check) || empty($check['id'])) {
                    continue;
                }
                $existing = SecurityRiskCheck::query()->where('check_id', $check['id'])->first();
                $status = ($existing && $existing->status === 'ignore')
                    ? 'ignore'
                    : ($check['status'] ?? 'unknown');
                SecurityRiskCheck::query()->updateOrCreate(
                    ['check_id' => $check['id']],
                    [
                        'status' => $status,
                        'fixable' => (bool) ($check['fixable'] ?? false),
                        'title' => $check['title'] ?? $check['id'],
                        'detail' => $check['detail'] ?? null,
                        'scanned_at' => now(),
                    ]
                );
            }
        }

        $stored = SecurityRiskCheck::query()->orderBy('check_id')->get();

        return response()->json([
            'checks' => $stored,
            'live' => $payload,
        ]);
    }

    public function fix(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'max:64'],
        ]);

        $result = $this->agent->post('/v1/security/risks', [
            'action' => 'fix',
            'id' => $data['id'],
        ]);

        if ($result['ok'] ?? false) {
            SecurityRiskCheck::query()->where('check_id', $data['id'])->update([
                'status' => 'pass',
                'scanned_at' => now(),
            ]);
        }

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function ignore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'max:64'],
        ]);

        $row = SecurityRiskCheck::query()->updateOrCreate(
            ['check_id' => $data['id']],
            ['status' => 'ignore', 'scanned_at' => now()]
        );

        return response()->json(['check' => $row]);
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
