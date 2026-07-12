<?php

namespace Modules\Backup\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Rules\SafeOutboundUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Backup\Entities\BackupTarget;
use Modules\Backup\Support\BackupTargetRedactor;

class BackupTargetController extends Controller
{
    public function index(): JsonResponse
    {
        $targets = BackupTarget::query()->orderBy('name')->get()
            ->map(fn (BackupTarget $target) => BackupTargetRedactor::redact($target));

        return response()->json(['targets' => $targets]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'driver' => ['required', 'in:s3,sftp,rest,local'],
            'config' => ['required', 'array'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $this->validateDriverConfig($data['driver'], $data['config']);

        $target = BackupTarget::query()->create([
            'name' => $data['name'],
            'driver' => $data['driver'],
            'config' => $data['config'],
            'enabled' => $data['enabled'] ?? true,
        ]);

        return response()->json(['target' => BackupTargetRedactor::redact($target)], 201);
    }

    public function update(Request $request, BackupTarget $target): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'driver' => ['sometimes', 'in:s3,sftp,rest,local'],
            'config' => ['sometimes', 'array'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $driver = $data['driver'] ?? $target->driver;
        if (isset($data['config'])) {
            $this->validateDriverConfig($driver, $data['config']);
        }

        $target->update($data);

        return response()->json(['target' => BackupTargetRedactor::redact($target->fresh())]);
    }

    public function destroy(BackupTarget $target): JsonResponse
    {
        $target->delete();

        return response()->json(['message' => __('backup.target_deleted')]);
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function validateDriverConfig(string $driver, array $config): void
    {
        if ($driver === 'rest' && ! empty($config['url'])) {
            validator(['url' => $config['url']], [
                'url' => ['required', new SafeOutboundUrl],
            ])->validate();
        }
    }
}
