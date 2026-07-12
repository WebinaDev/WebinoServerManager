<?php

namespace Modules\Core\Console\Commands;

use App\Services\Agent\AgentClient;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Modules\Backup\Entities\Backup;
use Modules\Cron\Entities\CronJob;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Dns\Entities\DnsZone;
use Modules\Domains\Entities\HostingDomain;
use Modules\Email\Entities\MailAccount;
use Modules\Ftp\Entities\FtpAccount;
use Modules\Git\Entities\GitRepository;
use Modules\Ssl\Entities\SslCertificate;
use Modules\Subdomains\Entities\HostingSubdomain;
use Modules\Wordpress\Entities\WordpressSite;

class ReconcileHostCommand extends Command
{
    protected $signature = 'panel:reconcile-host';

    protected $description = 'Compare panel metadata with live host state via agent list endpoints';

    public function handle(AgentClient $agent): int
    {
        $this->reconcileDomains($agent);
        $this->reconcileDatabases($agent);
        $this->reconcileDnsZones($agent);
        $this->reconcileDnsRecords($agent);
        $this->reconcileSslCerts($agent);
        $this->reconcileFtpAccounts($agent);
        $this->reconcileMailAccounts($agent);
        $this->reconcileCronJobs($agent);
        $this->reconcileBackups($agent);
        $this->reconcileGitRepositories($agent);
        $this->reconcileWordpressSites($agent);
        $this->reconcileSubdomains($agent);

        $this->info('Host reconciliation complete.');

        return self::SUCCESS;
    }

    private function reconcileDomains(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/domains', 'domains');
        $keys = $this->extractKeys($remote, ['domain', 'slug']);
        $this->syncRows(
            HostingDomain::query()->get(),
            fn (HostingDomain $row) => $row->domain,
            $keys,
            'domain',
        );
    }

    private function reconcileDatabases(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/databases', 'databases');
        $keys = $this->extractKeys($remote, ['name']);
        $this->syncRows(
            HostingDatabase::query()->get(),
            fn (HostingDatabase $row) => $row->name,
            $keys,
            'database',
        );
    }

    private function reconcileDnsZones(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/dns/zones', 'zones');
        $keys = $this->extractKeys($remote, ['domain']);
        $this->syncRows(
            DnsZone::query()->get(),
            fn (DnsZone $row) => strtolower($row->domain),
            $keys,
            'dns zone',
        );
    }

    private function reconcileDnsRecords(AgentClient $agent): void
    {
        $counts = $this->agentCounts($agent, '/v1/dns/records/counts');
        foreach (DnsZone::query()->with('records')->get() as $zone) {
            $dbCount = $zone->records->count();
            $remoteCount = $counts[strtolower($zone->domain)] ?? 0;
            if ($dbCount > 0 && $remoteCount < $dbCount) {
                foreach ($zone->records as $record) {
                    if ($record->status === 'active') {
                        $record->update([
                            'status' => 'drift',
                            'last_error' => 'Record count mismatch during reconciliation',
                        ]);
                        $this->warn("Drift detected for dns record: {$record->getKey()}");
                    }
                }
            }
        }
    }

    private function reconcileSslCerts(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/ssl/certificates', 'certificates');
        $remoteByDomain = [];
        foreach ($remote as $item) {
            if (! is_array($item) || empty($item['domain'])) {
                continue;
            }
            $remoteByDomain[strtolower((string) $item['domain'])] = $item;
        }
        $keys = array_keys($remoteByDomain);
        $this->syncRows(
            SslCertificate::query()->get(),
            fn (SslCertificate $row) => strtolower($row->domain),
            $keys,
            'ssl certificate',
        );
        foreach (SslCertificate::query()->get() as $cert) {
            $remote = $remoteByDomain[strtolower($cert->domain)] ?? null;
            if ($remote === null) {
                continue;
            }
            $updates = [];
            if (! empty($remote['expires_at'])) {
                $updates['expires_at'] = $remote['expires_at'];
            }
            if (! empty($remote['issuer'])) {
                $updates['issuer'] = $remote['issuer'];
            }
            if ($updates !== []) {
                $cert->update($updates);
            }
        }
    }

    private function reconcileFtpAccounts(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/ftp/accounts', 'accounts');
        $keys = $this->extractKeys($remote, ['username']);
        $this->syncRows(
            FtpAccount::query()->get(),
            fn (FtpAccount $row) => $row->username,
            $keys,
            'ftp account',
        );
    }

    private function reconcileMailAccounts(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/mail/accounts', 'accounts');
        $keys = $this->extractKeys($remote, ['address']);
        $this->syncRows(
            MailAccount::query()->get(),
            fn (MailAccount $row) => strtolower($row->address),
            $keys,
            'mail account',
        );
    }

    private function reconcileCronJobs(AgentClient $agent): void
    {
        $remoteByUser = [];

        foreach (CronJob::query()->with('hostingAccount')->get() as $job) {
            $username = $job->hostingAccount?->username ?? '';
            if (! array_key_exists($username, $remoteByUser)) {
                $path = '/v1/cron';
                if ($username !== '') {
                    $path .= '?username='.urlencode($username);
                }
                $remote = $this->agentList($agent, $path, 'entries');
                $lines = [];
                foreach ($remote as $entry) {
                    if (is_array($entry) && isset($entry['line'])) {
                        $lines[] = (string) $entry['line'];
                    }
                }
                $remoteByUser[$username] = $lines;
            }

            $line = trim($job->schedule.' '.$job->command);
            $onHost = in_array($line, $remoteByUser[$username], true);
            $this->updateRowStatus($job, $onHost, 'cron job');
        }
    }

    private function reconcileBackups(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/backups', 'backups');
        $keys = $this->extractKeys($remote, ['filename']);
        $this->syncRows(
            Backup::query()->get(),
            fn (Backup $row) => $row->filename,
            $keys,
            'backup',
        );
    }

    private function reconcileGitRepositories(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/git', 'repositories');
        $keys = $this->extractKeys($remote, ['target_dir']);
        $this->syncRows(
            GitRepository::query()->get(),
            fn (GitRepository $row) => strtolower($row->target_dir),
            $keys,
            'git repository',
        );
    }

    private function reconcileWordpressSites(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/wordpress', 'sites');
        $keys = $this->extractKeys($remote, ['path']);
        $this->syncRows(
            WordpressSite::query()->get(),
            fn (WordpressSite $row) => strtolower($row->path),
            $keys,
            'wordpress site',
        );
    }

    private function reconcileSubdomains(AgentClient $agent): void
    {
        $remote = $this->agentList($agent, '/v1/vhosts', 'vhosts');
        $keys = $this->extractKeys($remote, ['fqdn', 'server_name', 'name']);
        $this->syncRows(
            HostingSubdomain::query()->get(),
            fn (HostingSubdomain $row) => strtolower($row->fqdn),
            $keys,
            'subdomain',
        );
    }

    /**
     * @return array<string, int>
     */
    private function agentCounts(AgentClient $agent, string $path): array
    {
        try {
            $result = $agent->get($path);
            if (! ($result['ok'] ?? false)) {
                return [];
            }
            $data = $result['data'] ?? [];
            if (is_string($data)) {
                $data = json_decode($data, true) ?? [];
            }
            if (! is_array($data)) {
                return [];
            }
            $counts = [];
            foreach ($data as $zone => $count) {
                if (is_numeric($count)) {
                    $counts[strtolower((string) $zone)] = (int) $count;
                }
            }

            return $counts;
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function agentList(AgentClient $agent, string $path, string $key): array
    {
        try {
            $result = $agent->get($path);
            if (! ($result['ok'] ?? false)) {
                return [];
            }
            $data = $result['data'] ?? [];
            if (is_string($data)) {
                $data = json_decode($data, true) ?? [];
            }
            $list = $data[$key] ?? [];

            return is_array($list) ? $list : [];
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param  list<array<string, mixed>>  $remote
     * @param  list<string>  $fields
     * @return list<string>
     */
    private function extractKeys(array $remote, array $fields): array
    {
        $keys = [];
        foreach ($remote as $item) {
            if (! is_array($item)) {
                continue;
            }
            foreach ($fields as $field) {
                if (isset($item[$field]) && $item[$field] !== '') {
                    $keys[] = strtolower((string) $item[$field]);
                    break;
                }
            }
        }

        return $keys;
    }

    /**
     * @template T of Model
     *
     * @param  iterable<T>  $rows
     * @param  callable(T): string  $keyFn
     * @param  list<string>  $remoteKeys
     */
    private function syncRows(iterable $rows, callable $keyFn, array $remoteKeys, string $label): void
    {
        $remoteSet = array_fill_keys($remoteKeys, true);
        foreach ($rows as $row) {
            $key = strtolower($keyFn($row));
            $onHost = isset($remoteSet[$key]);
            $this->updateRowStatus($row, $onHost, $label);
        }
    }

    private function updateRowStatus(Model $row, bool $onHost, string $label): void
    {
        if (! in_array('status', $row->getFillable(), true)) {
            return;
        }

        if ($onHost) {
            if ($row->status !== 'active') {
                $row->update(['status' => 'active', 'last_error' => null]);
                $this->line("Synced {$label}: {$row->getKey()}");
            }

            return;
        }

        if ($row->status === 'active' || $row->status === 'pending') {
            $row->update([
                'status' => 'drift',
                'last_error' => "Not found on host during reconciliation",
            ]);
            $this->warn("Drift detected for {$label}: {$row->getKey()}");
        }
    }
}
