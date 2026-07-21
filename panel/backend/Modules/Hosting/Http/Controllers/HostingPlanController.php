<?php

namespace Modules\Hosting\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Modules\Hosting\Entities\HostingPlan;

class HostingPlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'plans' => HostingPlan::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);

        $plan = HostingPlan::query()->create($data);

        return response()->json(['plan' => $plan, 'message' => __('hosting.plan_saved')], 201);
    }

    public function update(Request $request, HostingPlan $plan): JsonResponse
    {
        $data = $this->validated($request, partial: true);
        if (isset($data['name']) && ! isset($data['slug'])) {
            $data['slug'] = Str::slug($data['name']);
        }
        $plan->update($data);

        return response()->json(['plan' => $plan->fresh(), 'message' => __('hosting.plan_saved')]);
    }

    public function destroy(HostingPlan $plan): JsonResponse
    {
        if ($plan->accounts()->exists()) {
            return response()->json(['message' => __('hosting.plan_in_use')], 422);
        }
        $plan->delete();

        return response()->json(['message' => __('hosting.plan_deleted')]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, bool $partial = false): array
    {
        $rules = [
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', 'unique:hosting_plans,slug'],
            'disk_mb' => ['sometimes', 'integer', 'min:1'],
            'bandwidth_mb' => ['sometimes', 'integer', 'min:1'],
            'inodes' => ['sometimes', 'integer', 'min:1'],
            'max_domains' => ['sometimes', 'integer', 'min:0'],
            'max_subdomains' => ['sometimes', 'integer', 'min:0'],
            'max_databases' => ['sometimes', 'integer', 'min:0'],
            'max_mailboxes' => ['sometimes', 'integer', 'min:0'],
            'max_ftp' => ['sometimes', 'integer', 'min:0'],
            'max_cron' => ['sometimes', 'integer', 'min:0'],
            'max_apps' => ['sometimes', 'integer', 'min:0'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'enabled' => ['sometimes', 'boolean'],
        ];

        return $request->validate($rules);
    }
}
