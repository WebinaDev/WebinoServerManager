<?php

namespace Modules\Products\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->webina(['product', 'list']);
        $data = $this->agentData($result);

        return response()->json([
            'ok' => (bool) ($result['ok'] ?? false),
            'products' => $data['products'] ?? [],
            'output' => $data['output'] ?? null,
            'error' => $result['error'] ?? null,
        ], ($result['ok'] ?? false) ? 200 : 422);
    }

    public function install(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'in:Webino,WebinoERM'],
            'channel' => ['nullable', 'in:Dev,LTS,Beta'],
        ]);
        $args = ['product', 'install', $data['product']];
        if (! empty($data['channel'])) {
            $args[] = '--channel';
            $args[] = $data['channel'];
        }
        $result = $this->agent->webina($args);
        $payload = $this->agentData($result);
        $ok = (bool) ($result['ok'] ?? false);
        $body = array_merge($payload, [
            'ok' => $ok,
            'error' => $result['error'] ?? null,
        ]);
        if (! $ok && empty($body['message']) && ! empty($result['error'])) {
            $body['message'] = $result['error'];
        }

        return response()->json($body, $ok ? 200 : 422);
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function agentData(array $result): array
    {
        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);

            return is_array($decoded) ? $decoded : ['output' => $data];
        }

        return is_array($data) ? $data : [];
    }
}
