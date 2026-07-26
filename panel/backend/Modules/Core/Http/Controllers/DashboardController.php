<?php

namespace Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Domains\Entities\HostingDomain;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Metrics\Entities\MetricAlert;
use Modules\Metrics\Entities\MetricSample;
use Modules\Softstore\Entities\SoftstoreInstall;
use Modules\Softstore\Entities\SoftstorePin;

class DashboardController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function summary(): JsonResponse
    {
        $sample = MetricSample::query()->orderByDesc('collected_at')->first();
        $breaching = 0;

        if ($sample !== null) {
            $values = [
                'cpu' => $sample->cpu_percent,
                'mem' => $sample->mem_percent,
                'disk' => $sample->disk_percent,
                'load' => $sample->load1,
            ];
            foreach (MetricAlert::query()->where('enabled', true)->get() as $alert) {
                $value = $values[$alert->metric] ?? null;
                if ($value !== null && $alert->isBreaching($value)) {
                    $breaching++;
                }
            }
        }

        $systemStatus = match (true) {
            $breaching > 0 => 'alert',
            $sample === null => 'unknown',
            $sample->cpu_percent > 90 || $sample->mem_percent > 90 || $sample->disk_percent > 90 => 'warning',
            default => 'ok',
        };

        $sitesCount = 0;
        try {
            $agent = $this->agent->get('/v1/domains');
            $remote = $agent['data']['domains'] ?? $agent['data']['sites'] ?? [];
            if (is_array($remote)) {
                $sitesCount = count($remote);
            }
        } catch (\Throwable) {
            $sitesCount = 0;
        }

        $hostingAccounts = HostingAccount::query()->count();
        $hostingSuspended = HostingAccount::query()->where('status', 'suspended')->count();

        $softstorePins = [];
        try {
            $userId = request()->user()?->id;
            if ($userId) {
                $softstorePins = SoftstorePin::query()
                    ->with('package:id,slug,name,category')
                    ->where('user_id', $userId)
                    ->orderBy('id')
                    ->get()
                    ->map(fn (SoftstorePin $pin) => [
                        'package_id' => $pin->package_id,
                        'slug' => $pin->package?->slug,
                        'name' => $pin->package?->name,
                        'category' => $pin->package?->category,
                    ])
                    ->values()
                    ->all();
            }
        } catch (\Throwable) {
            $softstorePins = [];
        }
        return response()->json([
            'data' => [
                'domains' => HostingDomain::query()->count(),
                'databases' => HostingDatabase::query()->count(),
                'sites' => $sitesCount,
                'hosting_accounts' => $hostingAccounts,
                'hosting_suspended' => $hostingSuspended,
                'system_status' => $systemStatus,
                'cpu_percent' => $sample?->cpu_percent,
                'mem_percent' => $sample?->mem_percent,
                'disk_percent' => $sample?->disk_percent,
                'softstore_pins' => $softstorePins,
                'softstore_active_installs' => SoftstoreInstall::query()
                    ->whereIn('status', ['pending', 'running'])
                    ->count(),
            ],
        ]);
    }
}
