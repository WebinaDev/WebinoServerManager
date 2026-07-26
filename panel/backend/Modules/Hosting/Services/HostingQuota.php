<?php

namespace Modules\Hosting\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Hosting\Entities\HostingAccount;

class HostingQuota
{
    private const RESOURCE_MAP = [
        'domains' => ['table' => 'hosting_domains', 'column' => 'max_domains'],
        'websites' => ['table' => 'hosting_websites', 'column' => 'max_domains'],
        'subdomains' => ['table' => 'hosting_subdomains', 'column' => 'max_subdomains'],
        'databases' => ['table' => 'hosting_databases', 'column' => 'max_databases'],
        'mailboxes' => ['table' => 'mail_accounts', 'column' => 'max_mailboxes'],
        'ftp' => ['table' => 'ftp_accounts', 'column' => 'max_ftp'],
        'cron' => ['table' => 'cron_jobs', 'column' => 'max_cron'],
        'apps' => ['table' => 'docker_apps', 'column' => 'max_apps'],
    ];

    public function check(HostingAccount $account, string $resource): bool
    {
        $map = self::RESOURCE_MAP[$resource] ?? null;
        if ($map === null) {
            return true;
        }

        $account->loadMissing('plan');
        $plan = $account->plan;
        if ($plan === null) {
            return true;
        }

        $limit = (int) $plan->{$map['column']};
        if ($limit <= 0) {
            return true;
        }

        if (! Schema::hasTable($map['table'])) {
            return true;
        }

        $count = DB::table($map['table'])
            ->where('hosting_account_id', $account->id)
            ->count();

        return $count < $limit;
    }

    public function assert(HostingAccount $account, string $resource): void
    {
        if (! $this->check($account, $resource)) {
            abort(422, __('hosting.quota_exceeded', ['resource' => $resource]));
        }
    }

    /**
     * @return array<string, array{used: int, limit: int}>
     */
    public function usageSummary(HostingAccount $account): array
    {
        $account->loadMissing('plan');
        $plan = $account->plan;
        $out = [];

        foreach (self::RESOURCE_MAP as $resource => $map) {
            $limit = (int) ($plan?->{$map['column']} ?? 0);
            $used = 0;
            if (Schema::hasTable($map['table'])) {
                $used = (int) DB::table($map['table'])
                    ->where('hosting_account_id', $account->id)
                    ->count();
            }
            $out[$resource] = ['used' => $used, 'limit' => $limit];
        }

        $out['disk'] = [
            'used' => (int) $account->disk_used_mb,
            'limit' => (int) ($plan?->disk_mb ?? 0),
        ];
        $out['inodes'] = [
            'used' => (int) $account->inodes_used,
            'limit' => (int) ($plan?->inodes ?? 0),
        ];
        $out['bandwidth'] = [
            'used' => (int) ($account->bandwidth_used_mb ?? 0),
            'limit' => (int) ($plan?->bandwidth_mb ?? 0),
        ];

        return $out;
    }
}
