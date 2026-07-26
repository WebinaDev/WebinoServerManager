<?php

namespace Modules\Runtimes\Jobs;

use App\Services\Agent\AgentClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Runtimes\Entities\RuntimeVersion;

class InstallRuntimeVersionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly int $versionId,
    ) {}

    public function handle(AgentClient $agent): void
    {
        $version = RuntimeVersion::query()->find($this->versionId);
        if ($version === null) {
            return;
        }

        $version->update(['status' => 'installing', 'last_error' => null]);

        try {
            $result = $agent->post('/v1/runtimes/install', [
                'script_id' => $version->agent_script_id,
                'options' => [],
            ]);
        } catch (\Throwable $e) {
            $version->update(['status' => 'failed', 'last_error' => $e->getMessage()]);

            return;
        }

        if (! ($result['ok'] ?? false)) {
            $version->update([
                'status' => 'failed',
                'last_error' => $result['error'] ?? 'agent error',
            ]);

            return;
        }

        $version->update(['status' => 'installed', 'last_error' => null]);
    }
}
