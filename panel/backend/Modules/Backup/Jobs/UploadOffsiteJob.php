<?php

namespace Modules\Backup\Jobs;

use App\Services\Agent\AgentClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Backup\Entities\Backup;
use Modules\Backup\Entities\BackupTarget;
use Throwable;

class UploadOffsiteJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300, 900];

    public int $timeout = 600;

    public function __construct(
        public readonly int $backupId,
        public readonly int $targetId,
    ) {}

    public function uniqueId(): string
    {
        return "offsite:{$this->backupId}:{$this->targetId}";
    }

    public function handle(AgentClient $agent): void
    {
        $backup = Backup::query()->find($this->backupId);
        $target = BackupTarget::query()->find($this->targetId);
        if ($backup === null || $target === null) {
            return;
        }

        $base = rtrim(config('webino.backup_dir', '/var/backups/webino'), '/');
        $path = $base.'/'.basename(explode(',', $backup->filename)[0]);

        $result = $agent->post('/v1/backups', [
            'action' => 'offsite',
            'path' => $path,
            'restic_repo' => $target->resticRepo(),
            'restic_password' => $target->resticPassword(),
        ]);

        if (! ($result['ok'] ?? false)) {
            $error = (string) ($result['error'] ?? 'offsite upload failed');
            $backup->update(['last_error' => $error]);
            if ($this->isTransientAgentError($error)) {
                throw new \RuntimeException($error);
            }

            return;
        }

        $data = $this->agentPayload($result);
        $backup->update([
            'target_id' => $target->id,
            'snapshot_id' => $data['snapshot_id'] ?? $backup->snapshot_id,
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
