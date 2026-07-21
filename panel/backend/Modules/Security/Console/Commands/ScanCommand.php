<?php

namespace Modules\Security\Console\Commands;

use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Illuminate\Console\Command;
use Modules\Security\Entities\ClamAvScan;

class ScanCommand extends Command
{
    protected $signature = 'panel:clamav-scan {path?}';

    protected $description = 'Run ClamAV scan on host via agent';

    public function handle(AgentClient $agent): int
    {
        $path = $this->argument('path')
            ?? PanelSetting::get('clamav_schedule_path', '/var/www');

        $record = ClamAvScan::create([
            'path' => $path,
            'status' => 'running',
            'started_at' => now(),
        ]);

        $result = $agent->post('/v1/security/clamav', [
            'action' => 'scan',
            'path' => $path,
        ]);

        $ok = $result['ok'] ?? false;
        $payload = is_array($result['data'] ?? []) ? ($result['data'] ?? []) : [];

        $record->update([
            'status' => $ok ? 'completed' : 'failed',
            'infected_json' => $payload['infected'] ?? [],
            'finished_at' => now(),
            'error' => $ok ? null : ($result['error'] ?? null),
        ]);

        if (! $ok) {
            $this->error($result['error'] ?? 'scan failed');

            return self::FAILURE;
        }

        $count = count($payload['infected'] ?? []);
        $this->info("ClamAV scan completed. Infected files: {$count}");

        return self::SUCCESS;
    }
}
