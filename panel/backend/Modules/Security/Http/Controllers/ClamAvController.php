<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Security\Entities\ClamAvScan;

class ClamAvController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function scan(Request $request): JsonResponse
    {
        $data = $request->validate(['path' => ['nullable', 'string']]);
        $scanPath = $data['path'] ?? '/';

        $record = ClamAvScan::create([
            'path' => $scanPath,
            'status' => 'running',
            'started_at' => now(),
        ]);

        $result = $this->agent->post('/v1/security/clamav', [
            'action' => 'scan',
            'path' => $scanPath,
        ]);

        $payload = $this->payload($result);
        $ok = $result['ok'] ?? false;

        $record->update([
            'status' => $ok ? 'completed' : 'failed',
            'infected_json' => $payload['infected'] ?? [],
            'finished_at' => now(),
            'error' => $ok ? null : ($result['error'] ?? null),
        ]);

        return response()->json($payload, $ok ? 200 : 422);
    }

    public function history(): JsonResponse
    {
        $scans = ClamAvScan::orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (ClamAvScan $s) => [
                'id' => $s->id,
                'path' => $s->path,
                'status' => $s->status,
                'infected' => $s->infected_json ?? [],
                'count' => count($s->infected_json ?? []),
                'started_at' => $s->started_at?->toIso8601String(),
                'finished_at' => $s->finished_at?->toIso8601String(),
                'error' => $s->error,
            ]);

        return response()->json(['scans' => $scans]);
    }

    public function getSchedule(): JsonResponse
    {
        return response()->json([
            'enabled' => (bool) PanelSetting::get('clamav_schedule_enabled', false),
            'path' => PanelSetting::get('clamav_schedule_path', '/var/www'),
        ]);
    }

    public function updateSchedule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'path' => ['nullable', 'string', 'max:255'],
        ]);

        PanelSetting::set('clamav_schedule_enabled', $data['enabled']);
        PanelSetting::set('clamav_schedule_path', $data['path'] ?? '/var/www');

        return response()->json([
            'enabled' => $data['enabled'],
            'path' => $data['path'] ?? '/var/www',
        ]);
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
