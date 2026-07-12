<?php

namespace Modules\Email\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AntispamController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/mail/antispam');

        return response()->json($this->payload($result));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'greylisting' => ['sometimes', 'boolean'],
            'antispam' => ['sometimes', 'boolean'],
        ]);
        $result = $this->agent->post('/v1/mail/antispam', $data);

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
