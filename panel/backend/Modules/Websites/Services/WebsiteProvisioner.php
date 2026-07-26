<?php

namespace Modules\Websites\Services;

use App\Services\Agent\AgentClient;
use Illuminate\Support\Str;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Ftp\Entities\FtpAccount;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Services\HostingQuota;
use Modules\Php\Entities\PhpPool;
use Modules\Webserver\Entities\NginxVhost;
use Modules\Websites\Entities\HostingWebsite;
use RuntimeException;

class WebsiteProvisioner
{
    public function __construct(
        private readonly AgentClient $agent,
        private readonly HostingQuota $quota,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{website: HostingWebsite, credentials?: array<string, mixed>|null}
     */
    public function create(array $data): array
    {
        $fqdn = strtolower((string) $data['fqdn']);
        $docRoot = ltrim((string) ($data['document_root'] ?? 'sites/'.$fqdn.'/public'), '/');
        $type = (string) ($data['type'] ?? 'php');
        $aliases = $this->normalizeAliases($data['aliases'] ?? []);
        $denyPaths = $this->normalizeDenyPaths($data['deny_paths'] ?? []);

        if (! empty($data['hosting_account_id'])) {
            $account = HostingAccount::query()->findOrFail($data['hosting_account_id']);
            $this->quota->assert($account, 'websites');
        }

        $phpPool = $data['php_pool'] ?? null;
        $phpVersion = $data['php_version'] ?? '8.3';
        $createdPool = null;
        $createdFtp = null;
        $createdDb = null;
        $credentials = [];
        $vhost = null;

        try {
            if (! empty($data['create_php_pool']) && empty($phpPool) && $type === 'php') {
                $poolName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $fqdn) ?: 'site_'.Str::random(6);
                $createdPool = PhpPool::query()->create([
                    'name' => $poolName,
                    'domain' => $fqdn,
                    'php_version' => $phpVersion,
                    'settings' => [],
                    'status' => 'pending',
                ]);
                $poolResult = $this->agent->post('/v1/php/pools', [
                    'name' => $createdPool->name,
                    'domain' => $fqdn,
                    'php_version' => $phpVersion,
                    'settings' => [],
                    'action' => 'create',
                ]);
                if (! ($poolResult['ok'] ?? false)) {
                    throw new RuntimeException($poolResult['error'] ?? 'php pool provision failed');
                }
                $createdPool->update(['status' => 'active', 'last_error' => null]);
                $phpPool = $createdPool->name;
            }

            $configName = str_replace('.', '_', $fqdn);
            $engine = in_array(($data['engine'] ?? 'nginx'), ['nginx', 'apache'], true)
                ? ($data['engine'] ?? 'nginx')
                : 'nginx';
            $http3 = $engine === 'nginx' && (bool) ($data['http3'] ?? false);
            $vhost = NginxVhost::query()->create([
                'fqdn' => $fqdn,
                'config_name' => $configName,
                'engine' => $engine,
                'document_root' => $docRoot,
                'php_pool' => $type === 'php' ? $phpPool : null,
                'ssl_enabled' => (bool) ($data['ssl_enabled'] ?? false),
                'force_https' => (bool) ($data['force_https'] ?? false),
                'hsts' => (bool) ($data['hsts'] ?? false),
                'http3' => $http3,
                'status' => 'pending',
            ]);

            $payload = [
                'name' => $configName,
                'fqdn' => $fqdn,
                'aliases' => $aliases,
                'document_root' => $docRoot,
                'php_pool' => $type === 'php' ? $phpPool : null,
                'php_version' => $phpVersion,
                'ssl' => (bool) ($data['ssl_enabled'] ?? false),
                'force_https' => (bool) ($data['force_https'] ?? false),
                'hsts' => (bool) ($data['hsts'] ?? false),
                'http3' => $http3,
                'engine' => $engine,
                'hotlink_protect' => (bool) ($data['hotlink_protect'] ?? false),
                'rewrite_template' => $data['rewrite_template'] ?? 'none',
                'rewrite_custom' => $data['rewrite_custom'] ?? null,
                'deny_paths' => $denyPaths,
                'traffic_limit_mb' => $data['traffic_limit_mb'] ?? null,
                'proxy_pass' => $type === 'proxy' ? ($data['proxy_pass'] ?? null) : null,
            ];

            $vhostResult = $this->agent->post('/v1/vhosts', $payload);
            if (! ($vhostResult['ok'] ?? false)) {
                throw new RuntimeException($vhostResult['error'] ?? 'vhost provision failed');
            }
            $vhost->update(['status' => 'active', 'last_error' => null]);

            if (! empty($data['issue_ssl'])) {
                $this->agent->post('/v1/vhosts/'.$configName.'/ssl', ['engine' => $engine]);
            }

            if (! empty($data['create_ftp'])) {
                $ftpUser = (string) ($data['ftp_username'] ?? ('ftp_'.Str::lower(Str::random(8))));
                $ftpPass = (string) ($data['ftp_password'] ?? Str::password(16));
                if (! empty($data['hosting_account_id'])) {
                    $this->quota->assert(HostingAccount::findOrFail($data['hosting_account_id']), 'ftp');
                }
                $createdFtp = FtpAccount::query()->create([
                    'username' => $ftpUser,
                    'home_dir' => $docRoot,
                    'domain' => $fqdn,
                    'status' => 'pending',
                ]);
                $ftpResult = $this->agent->post('/v1/ftp/accounts', [
                    'username' => $ftpUser,
                    'password' => $ftpPass,
                    'home_dir' => $docRoot,
                    'action' => 'create',
                ]);
                if (! ($ftpResult['ok'] ?? false)) {
                    throw new RuntimeException($ftpResult['error'] ?? 'ftp provision failed');
                }
                $createdFtp->update(['status' => 'active', 'last_error' => null]);
                $credentials['ftp'] = ['username' => $ftpUser, 'password' => $ftpPass];
            }

            if (! empty($data['create_database'])) {
                $dbName = (string) ($data['database_name'] ?? ('db_'.Str::lower(Str::random(8))));
                if (! empty($data['hosting_account_id'])) {
                    $this->quota->assert(HostingAccount::findOrFail($data['hosting_account_id']), 'databases');
                }
                $dbUser = 'u_'.Str::lower(Str::random(8));
                $dbPass = Str::password(16);
                $createdDb = HostingDatabase::query()->create([
                    'name' => $dbName,
                    'engine' => 'mysql',
                    'db_user' => $dbUser,
                    'hosting_account_id' => $data['hosting_account_id'] ?? null,
                    'status' => 'pending',
                ]);
                $dbResult = $this->agent->post('/v1/databases', [
                    'action' => 'create',
                    'name' => $dbName,
                    'engine' => 'mysql',
                    'user' => $dbUser,
                    'password' => $dbPass,
                ]);
                if (! ($dbResult['ok'] ?? false)) {
                    throw new RuntimeException($dbResult['error'] ?? 'database provision failed');
                }
                $createdDb->update([
                    'status' => 'active',
                    'last_error' => null,
                    'db_password_encrypted' => encrypt($dbPass),
                ]);
                $credentials['database'] = ['name' => $dbName, 'user' => $dbUser, 'password' => $dbPass];
            }

            $website = HostingWebsite::query()->create([
                'hosting_account_id' => $data['hosting_account_id'] ?? null,
                'fqdn' => $fqdn,
                'aliases' => $aliases,
                'type' => $type,
                'engine' => $engine,
                'document_root' => $docRoot,
                'php_pool' => $type === 'php' ? $phpPool : null,
                'php_version' => $phpVersion,
                'ssl_enabled' => (bool) ($data['ssl_enabled'] ?? false),
                'force_https' => (bool) ($data['force_https'] ?? false),
                'hsts' => (bool) ($data['hsts'] ?? false),
                'http3' => $http3,
                'hotlink_protect' => (bool) ($data['hotlink_protect'] ?? false),
                'rewrite_template' => $data['rewrite_template'] ?? 'none',
                'rewrite_custom' => $data['rewrite_custom'] ?? null,
                'deny_paths' => $denyPaths,
                'traffic_limit_mb' => $data['traffic_limit_mb'] ?? null,
                'proxy_pass' => $type === 'proxy' ? ($data['proxy_pass'] ?? null) : null,
                'vhost_id' => $vhost->id,
                'ftp_account_id' => $createdFtp?->id,
                'database_id' => $createdDb?->id,
                'status' => 'active',
            ]);

            return [
                'website' => $website->fresh(['vhost', 'ftpAccount', 'database']),
                'credentials' => $credentials === [] ? null : $credentials,
            ];
        } catch (\Throwable $e) {
            $this->compensate($vhost, $createdFtp, $createdDb, $createdPool);
            throw $e;
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(HostingWebsite $website, array $data): HostingWebsite
    {
        $engine = array_key_exists('engine', $data)
            ? (in_array($data['engine'], ['nginx', 'apache'], true) ? $data['engine'] : $website->engine)
            : ($website->engine ?? 'nginx');
        $http3 = $engine === 'nginx' && (array_key_exists('http3', $data)
            ? (bool) $data['http3']
            : (bool) $website->http3);

        $website->fill([
            'aliases' => array_key_exists('aliases', $data) ? $this->normalizeAliases($data['aliases']) : $website->aliases,
            'document_root' => $data['document_root'] ?? $website->document_root,
            'php_pool' => array_key_exists('php_pool', $data) ? $data['php_pool'] : $website->php_pool,
            'php_version' => $data['php_version'] ?? $website->php_version,
            'ssl_enabled' => array_key_exists('ssl_enabled', $data) ? (bool) $data['ssl_enabled'] : $website->ssl_enabled,
            'force_https' => array_key_exists('force_https', $data) ? (bool) $data['force_https'] : $website->force_https,
            'hsts' => array_key_exists('hsts', $data) ? (bool) $data['hsts'] : $website->hsts,
            'http3' => $http3,
            'engine' => $engine,
            'hotlink_protect' => array_key_exists('hotlink_protect', $data) ? (bool) $data['hotlink_protect'] : $website->hotlink_protect,
            'rewrite_template' => $data['rewrite_template'] ?? $website->rewrite_template,
            'rewrite_custom' => array_key_exists('rewrite_custom', $data) ? $data['rewrite_custom'] : $website->rewrite_custom,
            'deny_paths' => array_key_exists('deny_paths', $data) ? $this->normalizeDenyPaths($data['deny_paths']) : $website->deny_paths,
            'traffic_limit_mb' => array_key_exists('traffic_limit_mb', $data) ? $data['traffic_limit_mb'] : $website->traffic_limit_mb,
            'proxy_pass' => array_key_exists('proxy_pass', $data) ? $data['proxy_pass'] : $website->proxy_pass,
            'hosting_account_id' => array_key_exists('hosting_account_id', $data) ? $data['hosting_account_id'] : $website->hosting_account_id,
            'type' => $data['type'] ?? $website->type,
        ]);
        $website->save();

        if ($website->vhost_id) {
            $vhost = NginxVhost::query()->find($website->vhost_id);
            if ($vhost) {
                $vhost->update([
                    'document_root' => $website->document_root,
                    'php_pool' => $website->php_pool,
                    'ssl_enabled' => $website->ssl_enabled,
                    'force_https' => $website->force_https,
                    'hsts' => $website->hsts,
                    'engine' => $website->engine,
                    'http3' => $website->http3,
                ]);
            }
        }

        $result = $this->agent->post('/v1/vhosts', $this->agentPayload($website));
        if (! ($result['ok'] ?? false)) {
            $website->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);
            throw new RuntimeException($result['error'] ?? 'vhost update failed');
        }

        $website->update(['status' => 'active', 'last_error' => null]);

        return $website->fresh(['vhost', 'ftpAccount', 'database']);
    }

    public function destroy(HostingWebsite $website, bool $deleteFtp = false, bool $deleteDatabase = false): void
    {
        $name = $website->configName();
        $engine = $website->engine ?? 'nginx';
        $this->agent->delete('/v1/vhosts/'.$name.'?engine='.urlencode($engine));

        if ($deleteFtp && $website->ftp_account_id) {
            $ftp = FtpAccount::query()->find($website->ftp_account_id);
            if ($ftp) {
                $this->agent->post('/v1/ftp/accounts', ['username' => $ftp->username, 'action' => 'delete']);
                $ftp->delete();
            }
        }

        if ($deleteDatabase && $website->database_id) {
            $db = HostingDatabase::query()->find($website->database_id);
            if ($db) {
                if ($db->db_user) {
                    $this->agent->post('/v1/databases/users', [
                        'action' => 'drop_user',
                        'user' => $db->db_user,
                        'host' => 'localhost',
                    ]);
                }
                $this->agent->post('/v1/databases', [
                    'action' => 'delete_db',
                    'name' => $db->name,
                    'engine' => $db->engine ?? 'mysql',
                ]);
                $db->delete();
            }
        }

        if ($website->vhost_id) {
            NginxVhost::query()->where('id', $website->vhost_id)->delete();
        }

        $website->delete();
    }

    /**
     * @return array<string, mixed>
     */
    public function agentPayload(HostingWebsite $website): array
    {
        return [
            'name' => $website->configName(),
            'fqdn' => $website->fqdn,
            'aliases' => $website->aliases ?? [],
            'document_root' => $website->document_root,
            'php_pool' => $website->type === 'php' ? $website->php_pool : null,
            'php_version' => $website->php_version,
            'ssl' => $website->ssl_enabled,
            'force_https' => $website->force_https,
            'hsts' => $website->hsts,
            'http3' => (bool) $website->http3,
            'engine' => $website->engine ?? 'nginx',
            'hotlink_protect' => $website->hotlink_protect,
            'rewrite_template' => $website->rewrite_template,
            'rewrite_custom' => $website->rewrite_custom,
            'deny_paths' => $website->deny_paths ?? [],
            'traffic_limit_mb' => $website->traffic_limit_mb,
            'proxy_pass' => $website->type === 'proxy' ? $website->proxy_pass : null,
        ];
    }

    /**
     * @param  mixed  $aliases
     * @return list<string>
     */
    private function normalizeAliases(mixed $aliases): array
    {
        if (is_string($aliases)) {
            $aliases = preg_split('/[\s,]+/', $aliases) ?: [];
        }
        if (! is_array($aliases)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            fn ($a) => strtolower(trim((string) $a)),
            $aliases
        ))));
    }

    /**
     * @param  mixed  $paths
     * @return list<string>
     */
    private function normalizeDenyPaths(mixed $paths): array
    {
        if (is_string($paths)) {
            $paths = preg_split('/[\s,]+/', $paths) ?: [];
        }
        if (! is_array($paths)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn ($p) => trim((string) $p),
            $paths
        )));
    }

    private function compensate(
        ?NginxVhost $vhost,
        ?FtpAccount $ftp,
        ?HostingDatabase $db,
        ?PhpPool $pool,
    ): void {
        if ($vhost) {
            $this->agent->delete('/v1/vhosts/'.$vhost->config_name);
            $vhost->delete();
        }
        if ($ftp) {
            $this->agent->post('/v1/ftp/accounts', ['username' => $ftp->username, 'action' => 'delete']);
            $ftp->delete();
        }
        if ($db) {
            $this->agent->post('/v1/databases', [
                'action' => 'delete_db',
                'name' => $db->name,
                'engine' => $db->engine ?? 'mysql',
            ]);
            $db->delete();
        }
        if ($pool) {
            $this->agent->post('/v1/php/pools', ['name' => $pool->name, 'action' => 'delete']);
            $pool->delete();
        }
    }
}
