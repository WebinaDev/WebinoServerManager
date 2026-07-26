<?php

namespace Modules\Softstore\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Softstore\Entities\SoftstoreInstall;
use Modules\Softstore\Entities\SoftstorePackage;
use Modules\Softstore\Entities\SoftstorePin;
use Modules\Softstore\Jobs\InstallSoftstorePackageJob;

class SoftstoreController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function packages(): JsonResponse
    {
        $packages = SoftstorePackage::query()->orderBy('category')->orderBy('name')->get();
        $slugs = $packages->pluck('slug')->implode(',');
        $agentStatus = [];
        try {
            $res = $this->agent->get('/v1/softstore/status?packages='.urlencode($slugs));
            $data = $res['data'] ?? [];
            if (is_string($data)) {
                $data = json_decode($data, true) ?? [];
            }
            $agentStatus = is_array($data['packages'] ?? null) ? $data['packages'] : [];
        } catch (\Throwable) {
            $agentStatus = [];
        }

        $rows = $packages->map(function (SoftstorePackage $p) use ($agentStatus) {
            $probe = $agentStatus[$p->slug] ?? null;
            $hostStatus = is_array($probe) ? ($probe['status'] ?? 'unknown') : 'unknown';

            return [
                'id' => $p->id,
                'slug' => $p->slug,
                'name' => $p->name,
                'category' => $p->category,
                'description' => $p->description,
                'version_label' => $p->version_label,
                'agent_script_id' => $p->agent_script_id,
                'pinable' => $p->pinable,
                'host_status' => $hostStatus,
                'requires_website' => $p->category === 'cms',
            ];
        });

        return response()->json(['packages' => $rows]);
    }

    public function install(Request $request, string $slug): JsonResponse
    {
        $package = SoftstorePackage::query()->where('slug', $slug)->firstOrFail();
        $data = $request->validate([
            'website_id' => ['nullable', 'integer', 'exists:hosting_websites,id'],
        ]);

        if ($package->category === 'cms' && empty($data['website_id'])) {
            return response()->json(['message' => 'website_id required for CMS packages'], 422);
        }

        $install = SoftstoreInstall::query()->create([
            'package_id' => $package->id,
            'status' => 'pending',
            'requested_by' => $request->user()?->id,
            'website_id' => $data['website_id'] ?? null,
        ]);

        InstallSoftstorePackageJob::dispatch($install->id);

        return response()->json(['install' => $install->load('package')], 202);
    }

    public function installs(): JsonResponse
    {
        $rows = SoftstoreInstall::query()
            ->with('package:id,slug,name,category')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json(['installs' => $rows]);
    }

    public function showInstall(SoftstoreInstall $install): JsonResponse
    {
        return response()->json(['install' => $install->load('package')]);
    }

    public function pins(Request $request): JsonResponse
    {
        $pins = SoftstorePin::query()
            ->with('package:id,slug,name,category,description')
            ->where('user_id', $request->user()->id)
            ->orderBy('id')
            ->get();

        return response()->json(['pins' => $pins]);
    }

    public function pin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'package_id' => ['required_without:slug', 'integer', 'exists:softstore_packages,id'],
            'slug' => ['required_without:package_id', 'string', 'exists:softstore_packages,slug'],
        ]);

        $packageId = $data['package_id'] ?? SoftstorePackage::query()->where('slug', $data['slug'])->value('id');
        $package = SoftstorePackage::query()->findOrFail($packageId);
        if (! $package->pinable) {
            return response()->json(['message' => 'package not pinable'], 422);
        }

        $pin = SoftstorePin::query()->firstOrCreate([
            'user_id' => $request->user()->id,
            'package_id' => $package->id,
        ]);

        return response()->json(['pin' => $pin->load('package')], 201);
    }

    public function unpin(Request $request, int $packageId): JsonResponse
    {
        SoftstorePin::query()
            ->where('user_id', $request->user()->id)
            ->where('package_id', $packageId)
            ->delete();

        return response()->json(['ok' => true]);
    }
}
