<?php

namespace Modules\Backup\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Backup\Entities\BackupSchedule;

class BackupScheduleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'schedules' => BackupSchedule::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:files,db,full'],
            'target' => ['required', 'string', 'max:512'],
            'frequency' => ['required', 'in:hourly,daily,weekly'],
            'retention_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'target_id' => ['nullable', 'exists:backup_targets,id'],
            'mode' => ['sometimes', 'in:full,incremental'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $schedule = BackupSchedule::query()->create([
            'name' => $data['name'],
            'type' => $data['type'],
            'target' => $data['target'],
            'frequency' => $data['frequency'],
            'retention_days' => $data['retention_days'] ?? 7,
            'target_id' => $data['target_id'] ?? null,
            'mode' => $data['mode'] ?? 'full',
            'enabled' => $data['enabled'] ?? true,
            'next_run_at' => now(),
        ]);

        return response()->json(['schedule' => $schedule], 201);
    }

    public function update(Request $request, BackupSchedule $schedule): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'in:files,db,full'],
            'target' => ['sometimes', 'string', 'max:512'],
            'frequency' => ['sometimes', 'in:hourly,daily,weekly'],
            'retention_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'target_id' => ['nullable', 'exists:backup_targets,id'],
            'mode' => ['sometimes', 'in:full,incremental'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $schedule->update($data);

        return response()->json(['schedule' => $schedule->fresh()]);
    }

    public function destroy(BackupSchedule $schedule): JsonResponse
    {
        $schedule->delete();

        return response()->json(['message' => __('backup.schedule_deleted')]);
    }
}
