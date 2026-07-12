<?php

namespace Modules\Security\Console\Commands;

use App\Services\Agent\AgentClient;
use Illuminate\Console\Command;

class ScanCommand extends Command
{
    protected $signature = 'panel:clamav-scan {path?}';

    protected $description = 'Run ClamAV scan on host via agent';

    public function handle(AgentClient $agent): int
    {
        $path = $this->argument('path') ?? '/var/www';
        $result = $agent->post('/v1/security/clamav', [
            'action' => 'scan',
            'path' => $path,
        ]);

        if (! ($result['ok'] ?? false)) {
            $this->error($result['error'] ?? 'scan failed');

            return self::FAILURE;
        }

        $this->info('ClamAV scan completed.');

        return self::SUCCESS;
    }
}
