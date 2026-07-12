<?php

namespace Modules\Monitoring\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Rules\SafeUptimeTarget;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Monitoring\Entities\UptimeCheck;
use Modules\Monitoring\Entities\UptimeResult;

class UptimeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'checks' => UptimeCheck::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'target' => ['required', 'string', 'max:512'],
            'type' => ['required', 'in:http,tcp'],
            'interval_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        validator($data, [
            'target' => [new SafeUptimeTarget($data['type'])],
        ])->validate();

        $check = UptimeCheck::query()->create([
            'name' => $data['name'],
            'target' => $data['target'],
            'type' => $data['type'],
            'interval_minutes' => $data['interval_minutes'] ?? 5,
            'enabled' => $data['enabled'] ?? true,
        ]);

        return response()->json(['check' => $check], 201);
    }

    public function update(Request $request, UptimeCheck $check): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'target' => ['sometimes', 'string', 'max:512'],
            'type' => ['sometimes', 'in:http,tcp'],
            'interval_minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
            'enabled' => ['sometimes', 'boolean'],
        ]);

        $type = $data['type'] ?? $check->type;
        if (isset($data['target'])) {
            validator(['target' => $data['target']], [
                'target' => [new SafeUptimeTarget($type)],
            ])->validate();
        }

        $check->update($data);

        return response()->json(['check' => $check->fresh()]);
    }

    public function destroy(UptimeCheck $check): JsonResponse
    {
        $check->delete();

        return response()->json(['message' => __('monitoring.uptime_deleted')]);
    }

    public function results(UptimeCheck $check): JsonResponse
    {
        $results = UptimeResult::query()
            ->where('check_id', $check->id)
            ->orderByDesc('checked_at')
            ->limit(100)
            ->get();

        return response()->json(['check' => $check, 'results' => $results]);
    }
}
