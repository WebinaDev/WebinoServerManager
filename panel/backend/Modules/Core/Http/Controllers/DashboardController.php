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
use Modules\Security\Entities\ClamAvScan;
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
            $data = $this->agentPayload($agent);
            $remote = $data['domains'] ?? $data['sites'] ?? [];
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

        $live = $this->liveSystemSnapshot();
        $securityRisk = $this->buildSecurityRisk();

        $recentInstalls = SoftstoreInstall::query()
            ->with('package:id,slug,name')
            ->orderByDesc('id')
            ->limit(8)
            ->get()
            ->map(fn (SoftstoreInstall $row) => [
                'id' => $row->id,
                'status' => $row->status,
                'package' => $row->package?->name ?? $row->package?->slug,
                'log' => $row->log ? mb_substr($row->log, 0, 200) : null,
                'created_at' => $row->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

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
                'net_rx_bps' => $sample?->net_rx_bps ?? ($live['nic']['rx_bps'] ?? null),
                'net_tx_bps' => $sample?->net_tx_bps ?? ($live['nic']['tx_bps'] ?? null),
                'disk_read_bps' => $sample?->disk_read_bps ?? ($live['disk_io']['read_bps'] ?? null),
                'disk_write_bps' => $sample?->disk_write_bps ?? ($live['disk_io']['write_bps'] ?? null),
                'top_processes' => $live['top_processes'] ?? [],
                'nic' => $live['nic'] ?? null,
                'disk_io' => $live['disk_io'] ?? null,
                'security_risk' => $securityRisk,
                'softstore_pins' => $softstorePins,
                'softstore_active_installs' => SoftstoreInstall::query()
                    ->whereIn('status', ['pending', 'running'])
                    ->count(),
                'softstore_recent_installs' => $recentInstalls,
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function liveSystemSnapshot(): array
    {
        try {
            $result = $this->agent->get('/v1/system/info');
            if (! ($result['ok'] ?? false)) {
                return [];
            }

            return $this->agentPayload($result);
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return array{level: string, items: list<array{key: string, label: string, href: string, severity: string}>}
     */
    private function buildSecurityRisk(): array
    {
        $items = [];
        $level = 'ok';

        try {
            $fw = $this->agent->get('/v1/security/firewall');
            $fwData = $this->agentPayload($fw);
            $active = (bool) ($fwData['active'] ?? $fwData['enabled'] ?? false);
            if (! $active && ($fw['ok'] ?? false)) {
                $items[] = [
                    'key' => 'firewall_inactive',
                    'label' => 'Firewall inactive',
                    'href' => '/security/firewall',
                    'severity' => 'warning',
                ];
                $level = 'warning';
            }
        } catch (\Throwable) {
            // ignore
        }

        try {
            $f2b = $this->agent->get('/v1/security/fail2ban');
            $f2bData = $this->agentPayload($f2b);
            $banned = 0;
            if (isset($f2bData['banned_total'])) {
                $banned = (int) $f2bData['banned_total'];
            } elseif (isset($f2bData['jails']) && is_array($f2bData['jails'])) {
                foreach ($f2bData['jails'] as $jail) {
                    if (is_array($jail)) {
                        $banned += (int) ($jail['banned'] ?? $jail['currently_banned'] ?? 0);
                    }
                }
            }
            if ($banned > 0) {
                $items[] = [
                    'key' => 'fail2ban_bans',
                    'label' => $banned.' fail2ban ban(s)',
                    'href' => '/security/fail2ban',
                    'severity' => 'info',
                ];
            }
        } catch (\Throwable) {
            // ignore
        }

        try {
            if (class_exists(ClamAvScan::class)) {
                $last = ClamAvScan::query()->orderByDesc('id')->first();
                $infectedList = is_array($last?->infected_json) ? $last->infected_json : [];
                $infected = count($infectedList);
                if ($infected > 0) {
                    $items[] = [
                        'key' => 'clamav_infected',
                        'label' => $infected.' ClamAV threat(s) in last scan',
                        'href' => '/security/clamav',
                        'severity' => 'alert',
                    ];
                    $level = 'alert';
                }
            }
        } catch (\Throwable) {
            // ignore
        }

        if ($items === [] && $level === 'ok') {
            $items[] = [
                'key' => 'ok',
                'label' => 'No open security signals',
                'href' => '/security/firewall',
                'severity' => 'ok',
            ];
        }

        return ['level' => $level, 'items' => $items];
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
