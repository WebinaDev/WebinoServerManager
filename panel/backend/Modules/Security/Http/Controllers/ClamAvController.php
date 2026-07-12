<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClamAvController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function scan(Request $request): JsonResponse
    {
        $data = $request->validate(['path' => ['nullable', 'string']]);
        $result = $this->agent->post('/v1/security/clamav', [
            'action' => 'scan',
            'path' => $data['path'] ?? '/',
        ]);

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
