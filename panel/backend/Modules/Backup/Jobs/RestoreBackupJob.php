<?php

namespace Modules\Backup\Jobs;

use App\Services\Agent\AgentClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Backup\Entities\Backup;

class RestoreBackupJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly int $backupId,
        public readonly string $restoreTarget,
    ) {}

    public function handle(AgentClient $agent): void
    {
        $backup = Backup::query()->with('target')->find($this->backupId);
        if ($backup === null) {
            return;
        }

        $backup->update(['restore_status' => 'running']);
        $payload = [
            'action' => 'restore',
            'filename' => $backup->filename,
            'target' => $this->restoreTarget,
            'type' => $backup->type,
            'snapshot_id' => $backup->snapshot_id,
        ];
        if ($backup->target) {
            $payload['restic_repo'] = $backup->target->resticRepo();
            $payload['restic_password'] = $backup->target->resticPassword();
        }

        $result = $agent->post('/v1/backups', $payload);
        if (! ($result['ok'] ?? false)) {
            $backup->update([
                'restore_status' => 'error',
                'last_error' => $result['error'] ?? 'restore failed',
            ]);

            return;
        }

        $backup->update(['restore_status' => 'completed', 'last_error' => null]);
    }
}
