<?php

namespace Modules\System\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;

class SystemController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/system/info');

        if (! ($result['ok'] ?? false)) {
            return response()->json([
                'message' => $result['error'] ?? __('system.fetch_failed'),
            ], 422);
        }

        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            $data = is_array($decoded) ? $decoded : [];
        }

        return response()->json(['info' => $data]);
    }
}
