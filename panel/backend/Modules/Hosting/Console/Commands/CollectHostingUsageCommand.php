<?php

namespace Modules\Hosting\Console\Commands;

use App\Services\Agent\AgentClient;
use Illuminate\Console\Command;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Entities\HostingQuotaAlert;
use Modules\Hosting\Services\HostingQuota;
use Modules\Monitoring\Services\NotificationDispatcher;

class CollectHostingUsageCommand extends Command
{
    protected $signature = 'panel:collect-hosting-usage';

    protected $description = 'Collect disk and inode usage for hosting accounts from the agent';

    public function handle(AgentClient $agent, HostingQuota $quota, NotificationDispatcher $dispatcher): int
    {
        $accounts = HostingAccount::query()->where('status', 'active')->get();

        foreach ($accounts as $account) {
            $result = $agent->get('/v1/hosting/usage?account='.urlencode($account->username));

            if (! ($result['ok'] ?? false)) {
                $this->warn("Failed for {$account->username}: ".($result['error'] ?? 'unknown'));

                continue;
            }

            $data = $result['data'] ?? [];
            if (is_string($data)) {
                $data = json_decode($data, true) ?? [];
            }

            $account->update([
                'disk_used_mb' => (int) ($data['disk_mb'] ?? 0),
                'inodes_used' => (int) ($data['inodes'] ?? 0),
                'last_usage_at' => now(),
            ]);

            $this->line("Updated {$account->username}: {$data['disk_mb']} MB, {$data['inodes']} inodes");

            $this->evaluateQuotaAlerts($account, $quota, $dispatcher);
        }

        return self::SUCCESS;
    }

    private function evaluateQuotaAlerts(HostingAccount $account, HostingQuota $quota, NotificationDispatcher $dispatcher): void
    {
        $alerts = HostingQuotaAlert::query()
            ->where('hosting_account_id', $account->id)
            ->where('enabled', true)
            ->get();

        if ($alerts->isEmpty()) {
            return;
        }

        $usage = $quota->usageSummary($account->fresh());

        foreach ($alerts as $alert) {
            if (! $this->isBreaching($alert->resource, $usage, $alert->threshold_percent)) {
                if ($alert->breach_count > 0) {
                    $alert->update(['breach_count' => 0]);
                }

                continue;
            }

            if (! $alert->canNotify()) {
                continue;
            }

            $row = $usage[$alert->resource] ?? ['used' => 0, 'limit' => 0];
            $subject = __('hosting.quota_alert_subject', [
                'account' => $account->username,
                'resource' => $alert->resource,
            ]);
            $body = __('hosting.quota_alert_body', [
                'account' => $account->username,
                'resource' => $alert->resource,
                'used' => $row['used'],
                'limit' => $row['limit'],
                'threshold' => $alert->threshold_percent,
            ]);

            $channelTypes = match ($alert->escalation_channel) {
                'all' => null,
                'email' => ['email'],
                default => [$alert->escalation_channel],
            };
            $dispatcher->dispatch($subject, $body, $channelTypes);

            $alert->update([
                'last_notified_at' => now(),
                'breach_count' => $alert->breach_count + 1,
            ]);
        }
    }

    /**
     * @param  array<string, array{used: int, limit: int}>  $usage
     */
    private function isBreaching(string $resource, array $usage, int $thresholdPercent): bool
    {
        $row = $usage[$resource] ?? null;
        if ($row === null) {
            return false;
        }

        $limit = (int) ($row['limit'] ?? 0);
        if ($limit <= 0) {
            return false;
        }

        $used = (int) ($row['used'] ?? 0);
        $percent = ($used / $limit) * 100;

        return $percent >= $thresholdPercent;
    }
}
