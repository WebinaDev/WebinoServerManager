<?php

namespace Modules\Monitoring\Console\Commands;

use App\Events\AlertFired;
use App\Models\PanelSetting;
use App\Services\Security\OutboundUrlGuard;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Modules\Monitoring\Entities\UptimeCheck;
use Modules\Monitoring\Entities\UptimeResult;
use Modules\Monitoring\Services\NotificationDispatcher;

class CheckUptimeCommand extends Command
{
    protected $signature = 'panel:check-uptime';

    protected $description = 'Run due uptime checks and notify on failures';

    public function handle(NotificationDispatcher $dispatcher): int
    {
        $checks = UptimeCheck::query()->where('enabled', true)->get();

        foreach ($checks as $check) {
            if ($check->last_checked_at && $check->last_checked_at->gt(now()->subMinutes($check->interval_minutes))) {
                continue;
            }

            [$status, $latency] = $this->probe($check);
            $previous = $check->last_status;

            UptimeResult::query()->create([
                'check_id' => $check->id,
                'status' => $status,
                'latency_ms' => $latency,
                'checked_at' => now(),
            ]);

            $check->update([
                'last_status' => $status,
                'last_checked_at' => now(),
                'last_latency_ms' => $latency,
            ]);

            if ($status === 'down' && $previous !== 'down') {
                $dispatcher->dispatch(
                    __('monitoring.uptime_down_subject', ['name' => $check->name]),
                    __('monitoring.uptime_down_body', ['target' => $check->target, 'name' => $check->name])
                );

                AlertFired::dispatch('alert.fired', [
                    'source' => 'uptime',
                    'check_id' => $check->id,
                    'name' => $check->name,
                    'target' => $check->target,
                    'status' => $status,
                    'latency_ms' => $latency,
                ]);
            }

            $this->line("{$check->name}: {$status} ({$latency}ms)");
        }

        $retentionDays = (int) (PanelSetting::get('uptime_retention_days', 7));
        UptimeResult::query()
            ->where('checked_at', '<', now()->subDays($retentionDays))
            ->delete();

        return self::SUCCESS;
    }

    /**
     * @return array{0: string, 1: int}
     */
    private function probe(UptimeCheck $check): array
    {
        $start = microtime(true);

        if ($check->type === 'tcp') {
            try {
                OutboundUrlGuard::assertSafeTcpTarget($check->target);
            } catch (\InvalidArgumentException) {
                return ['down', (int) ((microtime(true) - $start) * 1000)];
            }

            $parts = explode(':', $check->target, 2);
            $host = $parts[0];
            $port = (int) ($parts[1] ?? 80);
            $conn = @fsockopen($host, $port, $errno, $errstr, 5);
            $latency = (int) ((microtime(true) - $start) * 1000);
            if ($conn) {
                fclose($conn);

                return ['up', $latency];
            }

            return ['down', $latency];
        }

        try {
            OutboundUrlGuard::assertSafeHttpUrl($check->target);
            $response = Http::timeout(10)->get($check->target);
            $latency = (int) ((microtime(true) - $start) * 1000);

            return [$response->successful() ? 'up' : 'down', $latency];
        } catch (\Throwable) {
            $latency = (int) ((microtime(true) - $start) * 1000);

            return ['down', $latency];
        }
    }
}
