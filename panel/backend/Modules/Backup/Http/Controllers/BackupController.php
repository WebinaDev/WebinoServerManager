<?php

namespace Modules\Backup\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Modules\Backup\Entities\Backup;
use Modules\Backup\Jobs\RestoreBackupJob;
use Modules\Backup\Jobs\VerifyBackupJob;
use Modules\Backup\Support\BackupTargetRedactor;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $backups = Backup::query()->with('target')->orderByDesc('id')->get()->map(function (Backup $backup) {
            $row = $backup->toArray();
            if ($backup->relationLoaded('target') && $backup->target !== null) {
                $row['target'] = BackupTargetRedactor::redact($backup->target);
            }

            return $row;
        });

        return response()->json(['backups' => $backups]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:files,db,full'],
            'target' => ['required', 'string', 'max:512'],
            'target_id' => ['nullable', 'exists:backup_targets,id'],
        ]);

        $backup = Backup::query()->create([
            'trigger' => 'manual',
            'type' => $data['type'],
            'target' => $data['target'],
            'target_id' => $data['target_id'] ?? null,
            'filename' => '',
            'status' => 'pending',
        ]);

        $payload = [
            'action' => 'create',
            'type' => $data['type'],
            'target' => $data['target'],
        ];
        if ($backup->target_id) {
            $backup->load('target');
            if ($backup->target) {
                $payload['restic_repo'] = $backup->target->resticRepo();
                $payload['restic_password'] = $backup->target->resticPassword();
            }
        }

        $result = $this->agent->post('/v1/backups', $payload);

        if (! ($result['ok'] ?? false)) {
            $backup->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('backup.create_failed'), 'backup' => $backup], 422);
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

        $fresh = $backup->fresh()->load('target');
        $payload = $fresh->toArray();
        if ($fresh->target !== null) {
            $payload['target'] = BackupTargetRedactor::redact($fresh->target);
        }

        return response()->json(['backup' => $payload, 'agent' => $result], 201);
    }

    public function restore(Request $request, Backup $backup): JsonResponse
    {
        $data = $request->validate([
            'restore_target' => ['required', 'string', 'max:512', 'regex:/^[a-zA-Z0-9._/ -]+$/'],
        ]);

        $data['restore_target'] = trim($data['restore_target'], '/');
        if (str_contains($data['restore_target'], '..')) {
            return response()->json(['message' => __('backup.invalid_restore_target')], 422);
        }

        RestoreBackupJob::dispatch($backup->id, $data['restore_target']);

        return response()->json(['message' => __('backup.restore_started'), 'backup' => $backup->fresh()]);
    }

    public function verify(Backup $backup): JsonResponse
    {
        VerifyBackupJob::dispatch($backup->id);

        return response()->json(['message' => __('backup.verify_started'), 'backup' => $backup->fresh()]);
    }

    public function download(Backup $backup): BinaryFileResponse|JsonResponse
    {
        $path = $this->backupPath($backup->filename);
        if (! File::isFile($path)) {
            return response()->json(['message' => __('backup.file_missing')], 404);
        }

        return response()->download($path, basename($backup->filename));
    }

    public function destroy(Backup $backup): JsonResponse
    {
        foreach (explode(',', $backup->filename) as $name) {
            $name = trim($name);
            if ($name === '') {
                continue;
            }
            $path = $this->backupPath($name);
            if (File::isFile($path)) {
                File::delete($path);
            }
        }
        $backup->delete();

        return response()->json(['message' => __('backup.deleted')]);
    }

    private function backupPath(string $filename): string
    {
        $base = rtrim(config('webino.backup_dir', '/var/backups/webino'), '/');
        $safe = basename($filename);

        return $base.'/'.$safe;
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
