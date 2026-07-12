<?php

namespace Modules\Php\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Php\Entities\PhpPool;

class PhpController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'pools' => PhpPool::query()->orderBy('name')->get(),
        ]);
    }

    public function ini(Request $request): JsonResponse
    {
        $version = $request->query('version', '8.3');
        $result = $this->agent->get('/v1/php/ini?version='.urlencode((string) $version));

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function updateIni(Request $request): JsonResponse
    {
        $data = $request->validate([
            'version' => ['nullable', 'string', 'max:8'],
            'content' => ['required', 'string', 'max:65535'],
        ]);

        $result = $this->agent->post('/v1/php/ini', $data);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function extensions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'version' => ['nullable', 'string', 'max:8'],
            'extension' => ['required', 'string', 'max:32', 'regex:/^[a-z0-9_-]+$/'],
            'action' => ['required', 'in:enable,disable'],
        ]);

        $result = $this->agent->post('/v1/php/extensions', $data);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:63', 'regex:/^[a-zA-Z0-9_-]+$/', 'unique:php_pools,name'],
            'domain' => ['nullable', 'string', 'max:253'],
            'php_version' => ['nullable', 'string', 'max:8'],
            'settings' => ['nullable', 'array'],
        ]);

        $pool = PhpPool::query()->create([
            'name' => $data['name'],
            'domain' => $data['domain'] ?? null,
            'php_version' => $data['php_version'] ?? '8.3',
            'settings' => $data['settings'] ?? [],
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/php/pools', [
            'name' => $pool->name,
            'domain' => $pool->domain,
            'php_version' => $pool->php_version,
            'settings' => $pool->settings ?? [],
            'action' => 'create',
        ]);

        if (! ($result['ok'] ?? false)) {
            $pool->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('php.provision_failed'), 'pool' => $pool], 422);
        }

        $pool->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['pool' => $pool->fresh(), 'agent' => $result], 201);
    }

    public function update(Request $request, PhpPool $pool): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['nullable', 'string', 'max:253'],
            'php_version' => ['nullable', 'string', 'max:8'],
            'settings' => ['nullable', 'array'],
        ]);

        $pool->update([
            'domain' => $data['domain'] ?? $pool->domain,
            'php_version' => $data['php_version'] ?? $pool->php_version,
            'settings' => $data['settings'] ?? $pool->settings,
        ]);

        $result = $this->agent->post('/v1/php/pools', [
            'name' => $pool->name,
            'domain' => $pool->domain,
            'php_version' => $pool->php_version,
            'settings' => $pool->settings ?? [],
            'action' => 'update',
        ]);

        if (! ($result['ok'] ?? false)) {
            $pool->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('php.provision_failed'), 'pool' => $pool], 422);
        }

        $pool->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['pool' => $pool->fresh(), 'agent' => $result]);
    }

    public function destroy(PhpPool $pool): JsonResponse
    {
        $this->agent->post('/v1/php/pools', [
            'name' => $pool->name,
            'action' => 'delete',
        ]);
        $pool->delete();

        return response()->json(['message' => __('php.deleted')]);
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
