<?php

namespace Modules\Backup\Jobs;

use App\Services\Agent\AgentClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Backup\Entities\Backup;
use Throwable;

class VerifyBackupJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300, 900];

    public int $timeout = 600;

    public function __construct(public readonly int $backupId) {}

    public function handle(AgentClient $agent): void
    {
        $backup = Backup::query()->with('target')->find($this->backupId);
        if ($backup === null) {
            return;
        }

        $payload = [
            'action' => 'verify',
            'filename' => $backup->filename,
        ];
        if ($backup->target) {
            $payload['restic_repo'] = $backup->target->resticRepo();
            $payload['restic_password'] = $backup->target->resticPassword();
        }

        $result = $agent->post('/v1/backups', $payload);
        if (! ($result['ok'] ?? false)) {
            $error = (string) ($result['error'] ?? 'verify failed');
            if ($this->isTransientAgentError($error)) {
                throw new \RuntimeException($error);
            }
            $backup->update(['last_error' => $error]);

            return;
        }

        $data = $this->agentPayload($result);
        $backup->update([
            'checksum' => $data['checksum'] ?? $backup->checksum,
            'verified_at' => now(),
            'last_error' => null,
        ]);
    }

    public function failed(Throwable $e): void
    {
        $backup = Backup::query()->find($this->backupId);
        $backup?->update(['last_error' => $e->getMessage()]);
    }

    private function isTransientAgentError(string $error): bool
    {
        $lower = strtolower($error);

        return str_contains($lower, 'timeout')
            || str_contains($lower, 'connection')
            || str_contains($lower, 'unavailable')
            || str_contains($lower, 'refused');
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
