<?php

namespace Modules\Core\Jobs;

use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Core\Entities\SetupStackRun;
use Modules\Core\Entities\SetupStackStep;

class RunSetupStackJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 3600;

    public function __construct(
        public readonly int $runId,
    ) {}

    public function handle(AgentClient $agent): void
    {
        $run = SetupStackRun::query()->with('steps')->find($this->runId);
        if ($run === null) {
            return;
        }

        if ($run->skip || $run->steps->isEmpty()) {
            $run->update(['status' => 'skipped']);
            PanelSetting::set('setup_completed', true);

            return;
        }

        $run->update(['status' => 'running', 'error' => null]);

        foreach ($run->steps as $step) {
            /** @var SetupStackStep $step */
            if ($step->status === 'success' || $step->status === 'skipped') {
                continue;
            }

            $step->update(['status' => 'running', 'log' => null]);

            try {
                $result = $agent->post('/v1/softstore/install', [
                    'script_id' => $step->script_id,
                    // Must be JSON object {} — Go map[string]any rejects []
                    'options' => new \stdClass(),
                ], 600);
            } catch (\Throwable $e) {
                $step->update(['status' => 'failed', 'log' => $e->getMessage()]);
                $run->update(['status' => 'failed', 'error' => $e->getMessage()]);

                return;
            }

            $log = $this->extractLog($result);

            if (! ($result['ok'] ?? false)) {
                $error = (string) ($result['error'] ?? 'agent error');
                $step->update([
                    'status' => 'failed',
                    'log' => $error.($log !== '' ? "\n".$log : ''),
                ]);
                $run->update(['status' => 'failed', 'error' => $error]);

                return;
            }

            $step->update([
                'status' => 'success',
                'log' => $log !== '' ? $log : 'ok',
            ]);
        }

        $run->update(['status' => 'success', 'error' => null]);
        PanelSetting::set('setup_completed', true);
    }

    /**
     * @param  array<string, mixed>  $result
     */
    private function extractLog(array $result): string
    {
        $data = $result['data'] ?? null;
        if (is_array($data)) {
            return (string) ($data['log'] ?? json_encode($data));
        }
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            if (is_array($decoded)) {
                return (string) ($decoded['log'] ?? $data);
            }

            return $data;
        }

        return '';
    }
}
