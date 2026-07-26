<?php

namespace Modules\Metrics\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Metrics\Entities\MetricAlert;
use Modules\Metrics\Entities\MetricSample;

class MetricsController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function current(): JsonResponse
    {
        $sample = MetricSample::query()->orderByDesc('collected_at')->first();
        $current = null;

        if ($sample === null || $sample->collected_at->lt(now()->subMinutes(5))) {
            $result = $this->agent->get('/v1/system/info');
            if ($result['ok'] ?? false) {
                $current = $this->agentPayload($result);
            }
        }

        if ($sample === null && $current === null) {
            return response()->json(['current' => null, 'sample' => null]);
        }

        return response()->json(['sample' => $sample, 'current' => $current]);
    }

    public function history(Request $request): JsonResponse
    {
        $range = $request->query('range', '1h');
        $since = match ($range) {
            '7d' => now()->subDays(7),
            '24h' => now()->subDay(),
            default => now()->subHour(),
        };

        $samples = MetricSample::query()
            ->where('collected_at', '>=', $since)
            ->orderBy('collected_at')
            ->get([
                'cpu_percent',
                'mem_percent',
                'disk_percent',
                'load1',
                'net_rx_bps',
                'net_tx_bps',
                'disk_read_bps',
                'disk_write_bps',
                'collected_at',
            ]);

        return response()->json(['samples' => $samples, 'range' => $range]);
    }

    public function indexAlerts(): JsonResponse
    {
        return response()->json([
            'alerts' => MetricAlert::query()->orderBy('metric')->get(),
        ]);
    }

    public function storeAlert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'metric' => ['required', 'in:cpu,mem,disk,load'],
            'comparison' => ['required', 'in:gt,lt'],
            'threshold' => ['required', 'numeric'],
            'enabled' => ['sometimes', 'boolean'],
            'channel' => ['sometimes', 'in:email,telegram,slack,webhook,all'],
            'cooldown_minutes' => ['sometimes', 'integer', 'min:1', 'max:10080'],
        ]);

        $alert = MetricAlert::query()->create([
            'metric' => $data['metric'],
            'comparison' => $data['comparison'],
            'threshold' => $data['threshold'],
            'enabled' => $data['enabled'] ?? true,
            'channel' => $data['channel'] ?? 'email',
            'cooldown_minutes' => $data['cooldown_minutes'] ?? 60,
        ]);

        return response()->json(['alert' => $alert], 201);
    }

    public function updateAlert(Request $request, MetricAlert $alert): JsonResponse
    {
        $data = $request->validate([
            'metric' => ['sometimes', 'in:cpu,mem,disk,load'],
            'comparison' => ['sometimes', 'in:gt,lt'],
            'threshold' => ['sometimes', 'numeric'],
            'enabled' => ['sometimes', 'boolean'],
            'channel' => ['sometimes', 'in:email,telegram,slack,webhook,all'],
            'cooldown_minutes' => ['sometimes', 'integer', 'min:1', 'max:10080'],
        ]);

        $alert->update($data);

        return response()->json(['alert' => $alert->fresh()]);
    }

    public function destroyAlert(MetricAlert $alert): JsonResponse
    {
        $alert->delete();

        return response()->json(['message' => __('metrics.alert_deleted')]);
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

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($data) ? $data : [];
    }
}
