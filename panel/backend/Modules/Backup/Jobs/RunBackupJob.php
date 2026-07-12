<?php

namespace Modules\Backup\Jobs;

use App\Events\BackupCompleted;
use App\Services\Agent\AgentClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\File;
use Modules\Backup\Entities\Backup;
use Modules\Backup\Entities\BackupSchedule;

class RunBackupJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly int $scheduleId,
    ) {}

    public function handle(AgentClient $agent): void
    {
        $schedule = BackupSchedule::query()->with('target')->find($this->scheduleId);
        if ($schedule === null || ! $schedule->enabled) {
            return;
        }

        $backup = Backup::query()->create([
            'schedule_id' => $schedule->id,
            'trigger' => 'scheduled',
            'type' => $schedule->type,
            'target' => $schedule->target,
            'target_id' => $schedule->target_id,
            'filename' => '',
            'status' => 'pending',
        ]);

        $payload = [
            'action' => 'create',
            'type' => $schedule->type,
            'target' => $schedule->target,
        ];
        if ($schedule->target) {
            $payload['restic_repo'] = $schedule->target->resticRepo();
            $payload['restic_password'] = $schedule->target->resticPassword();
        }

        $result = $agent->post('/v1/backups', $payload);

        if (! ($result['ok'] ?? false)) {
            $backup->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return;
        }

        $agentData = $this->agentPayload($result);
        $backup->update([
            'filename' => $agentData['filename'] ?? '',
            'size' => (int) ($agentData['size'] ?? 0),
            'checksum' => $agentData['checksum'] ?? null,
            'snapshot_id' => $agentData['snapshot_id'] ?? null,
            'status' => 'active',
            'last_error' => null,
        ]);

        VerifyBackupJob::dispatch($backup->id);
        if ($schedule->target_id) {
            UploadOffsiteJob::dispatch($backup->id, $schedule->target_id);
        }

        BackupCompleted::dispatch('backup.completed', [
            'backup_id' => $backup->id,
            'filename' => $backup->filename,
            'type' => $backup->type,
            'status' => $backup->status,
        ]);

        $this->enforceRetention($schedule);
    }

    private function enforceRetention(BackupSchedule $schedule): void
    {
        $cutoff = now()->subDays(max(1, $schedule->retention_days));
        $old = Backup::query()
            ->where('schedule_id', $schedule->id)
            ->where('created_at', '<', $cutoff)
            ->get();

        $base = rtrim(config('webino.backup_dir', '/var/backups/webino'), '/');
        foreach ($old as $backup) {
            foreach (explode(',', $backup->filename) as $name) {
                $name = trim($name);
                if ($name === '') {
                    continue;
                }
                $path = $base.'/'.basename($name);
                if (File::isFile($path)) {
                    File::delete($path);
                }
            }
            $backup->delete();
        }

        if ($schedule->target) {
            app(AgentClient::class)->post('/v1/backups', [
                'action' => 'restic_forget',
                'restic_repo' => $schedule->target->resticRepo(),
                'restic_password' => $schedule->target->resticPassword(),
                'keep_days' => (string) $schedule->retention_days,
            ]);
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
