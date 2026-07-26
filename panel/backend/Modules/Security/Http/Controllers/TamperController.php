<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Monitoring\Services\NotificationDispatcher;
use Modules\Security\Entities\SecurityTamperWatch;

class TamperController extends Controller
{
    public function __construct(
        private readonly AgentClient $agent,
        private readonly NotificationDispatcher $dispatcher,
    ) {}

    public function index(): JsonResponse
    {
        $status = $this->agentPayload($this->agent->get('/v1/security/tamper?action=status'));
        $watches = SecurityTamperWatch::query()->orderBy('id')->get();

        return response()->json([
            'status' => $status,
            'watches' => $watches,
        ]);
    }

    public function storeWatch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:512'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $watch = SecurityTamperWatch::query()->create([
            'path' => $data['path'],
            'enabled' => $data['enabled'] ?? true,
        ]);

        return response()->json(['watch' => $watch], 201);
    }

    public function destroyWatch(SecurityTamperWatch $watch): JsonResponse
    {
        $watch->delete();

        return response()->json(['ok' => true]);
    }

    public function baseline(): JsonResponse
    {
        $paths = SecurityTamperWatch::query()->where('enabled', true)->pluck('path')->all();
        $result = $this->agent->post('/v1/security/tamper', [
            'action' => 'baseline',
            'paths' => $paths,
        ]);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function scan(): JsonResponse
    {
        $result = $this->agent->get('/v1/security/tamper?action=scan');
        $payload = $this->agentPayload($result);
        $count = (int) ($payload['count'] ?? 0);

        SecurityTamperWatch::query()->where('enabled', true)->update([
            'last_diff_count' => $count,
            'last_scanned_at' => now(),
        ]);

        if ($count > 0) {
            $this->dispatcher->dispatch(
                'File tamper alert',
                "Tamper scan found {$count} changed or missing file(s)."
            );
        }

        return response()->json($payload, ($result['ok'] ?? false) ? 200 : 422);
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
