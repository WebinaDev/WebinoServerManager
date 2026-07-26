<?php

namespace Modules\Metrics\Console\Commands;

use App\Events\AlertFired;
use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Illuminate\Console\Command;
use Modules\Metrics\Entities\MetricAlert;
use Modules\Metrics\Entities\MetricSample;
use Modules\Monitoring\Services\NotificationDispatcher;

class CollectMetricsCommand extends Command
{
    protected $signature = 'panel:collect-metrics';

    protected $description = 'Collect host metrics from agent and evaluate alert thresholds';

    public function handle(AgentClient $agent): int
    {
        $result = $agent->get('/v1/system/info');
        if (! ($result['ok'] ?? false)) {
            $this->error($result['error'] ?? 'agent error');

            return self::FAILURE;
        }

        $info = $this->agentPayload($result);
        $collectedAt = isset($info['collected_at'])
            ? \Carbon\Carbon::parse($info['collected_at'])
            : now();

        $sample = MetricSample::query()->create([
            'cpu_percent' => (float) ($info['cpu_percent'] ?? 0),
            'mem_percent' => (float) ($info['mem_percent'] ?? 0),
            'disk_percent' => (float) ($info['disk_percent'] ?? 0),
            'load1' => (float) ($info['load1'] ?? 0),
            'net_rx_bps' => isset($info['nic']['rx_bps']) ? (float) $info['nic']['rx_bps'] : null,
            'net_tx_bps' => isset($info['nic']['tx_bps']) ? (float) $info['nic']['tx_bps'] : null,
            'disk_read_bps' => isset($info['disk_io']['read_bps']) ? (float) $info['disk_io']['read_bps'] : null,
            'disk_write_bps' => isset($info['disk_io']['write_bps']) ? (float) $info['disk_io']['write_bps'] : null,
            'collected_at' => $collectedAt,
        ]);

        $this->evaluateAlerts($sample);

        $retentionDays = (int) (PanelSetting::get('metrics_retention_days', 7));
        MetricSample::query()
            ->where('collected_at', '<', now()->subDays($retentionDays))
            ->delete();

        $this->info('Metrics collected.');

        return self::SUCCESS;
    }

    private function evaluateAlerts(MetricSample $sample): void
    {
        $values = [
            'cpu' => $sample->cpu_percent,
            'mem' => $sample->mem_percent,
            'disk' => $sample->disk_percent,
            'load' => $sample->load1,
        ];

        $dispatcher = app(NotificationDispatcher::class);
        $alerts = MetricAlert::query()->where('enabled', true)->get();
        foreach ($alerts as $alert) {
            $value = $values[$alert->metric] ?? null;
            if ($value === null || ! $alert->isBreaching($value) || ! $alert->canTrigger()) {
                continue;
            }

            $subject = __('metrics.alert_subject', ['metric' => $alert->metric]);
            $severity = $alert->severity ?? 'soft';
            $body = __('metrics.alert_body', [
                'metric' => $alert->metric,
                'value' => round($value, 2),
                'threshold' => $alert->threshold,
                'comparison' => $alert->comparison,
                'severity' => $severity,
            ]);
            if ($severity === 'hard') {
                $subject = '[HARD] '.$subject;
            }

            $channelTypes = match ($alert->channel) {
                'all' => null,
                'email' => ['email'],
                default => [$alert->channel],
            };
            $dispatcher->dispatch($subject, $body, $channelTypes);

            AlertFired::dispatch('alert.fired', [
                'source' => 'metrics',
                'metric' => $alert->metric,
                'value' => round($value, 2),
                'threshold' => $alert->threshold,
                'comparison' => $alert->comparison,
            ]);

            $alert->update(['last_triggered_at' => now()]);
        }
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
