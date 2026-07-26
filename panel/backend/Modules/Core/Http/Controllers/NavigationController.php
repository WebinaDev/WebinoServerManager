<?php

namespace Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Support\RoutePermission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NavigationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $sections = [
            [
                'id' => 'hosting',
                'label_key' => 'section_hosting',
                'items' => [
                    ['slug' => 'hosting-plans', 'path' => '/hosting/plans', 'label_key' => 'hosting_plans', 'permission' => 'hosting.manage'],
                    ['slug' => 'hosting-accounts', 'path' => '/hosting/accounts', 'label_key' => 'hosting_accounts', 'permission' => 'hosting.manage'],
                ],
            ],
            [
                'id' => 'access',
                'label_key' => 'section_access',
                'items' => [
                    ['slug' => 'users', 'path' => '/users', 'label_key' => 'rbac', 'permission' => 'users.manage'],
                ],
            ],
            [
                'id' => 'security',
                'label_key' => 'section_security',
                'items' => [
                    ['slug' => 'security-2fa', 'path' => '/security/2fa', 'label_key' => 'security_2fa'],
                    ['slug' => 'security-firewall', 'path' => '/security/firewall', 'label_key' => 'security_firewall', 'permission' => 'security.manage'],
                    ['slug' => 'security-waf', 'path' => '/security/waf', 'label_key' => 'security_waf', 'permission' => 'security.manage'],
                    ['slug' => 'security-fail2ban', 'path' => '/security/fail2ban', 'label_key' => 'security_fail2ban', 'permission' => 'security.manage'],
                    ['slug' => 'security-sshkeys', 'path' => '/security/sshkeys', 'label_key' => 'security_sshkeys', 'permission' => 'security.manage'],
                    ['slug' => 'security-clamav', 'path' => '/security/clamav', 'label_key' => 'security_clamav', 'permission' => 'security.manage'],
                    ['slug' => 'security-audit', 'path' => '/security/audit', 'label_key' => 'security_audit', 'permission' => 'security.manage'],
                ],
            ],
            [
                'id' => 'account',
                'label_key' => 'section_account',
                'items' => [
                    ['slug' => 'websites', 'path' => '/websites', 'label_key' => 'websites'],
                    ['slug' => 'domains', 'path' => '/domains', 'label_key' => 'domains'],
                    ['slug' => 'subdomains', 'path' => '/subdomains', 'label_key' => 'subdomains'],
                    ['slug' => 'dns', 'path' => '/dns', 'label_key' => 'dns'],
                    ['slug' => 'ssl', 'path' => '/ssl', 'label_key' => 'ssl'],
                    ['slug' => 'ftp', 'path' => '/ftp', 'label_key' => 'ftp'],
                    ['slug' => 'databases', 'path' => '/databases', 'label_key' => 'databases'],
                    ['slug' => 'phpmyadmin', 'path' => '/phpmyadmin', 'label_key' => 'phpmyadmin'],
                    ['slug' => 'phppgadmin', 'path' => '/phppgadmin', 'label_key' => 'phppgadmin'],
                    ['slug' => 'php', 'path' => '/php-settings', 'label_key' => 'php'],
                ],
            ],
            [
                'id' => 'webserver',
                'label_key' => 'section_webserver',
                'items' => [
                    ['slug' => 'webserver-vhosts', 'path' => '/webserver/vhosts', 'label_key' => 'webserver_vhosts', 'permission' => 'system.manage'],
                    ['slug' => 'apps', 'path' => '/apps', 'label_key' => 'apps', 'permission' => 'apps.manage'],
                    ['slug' => 'softstore', 'path' => '/softstore', 'label_key' => 'softstore'],
                ],
            ],
            [
                'id' => 'monitoring',
                'label_key' => 'section_monitoring',
                'items' => [
                    ['slug' => 'monitoring-services', 'path' => '/monitoring/services', 'label_key' => 'monitoring_services', 'permission' => 'monitoring.manage'],
                    ['slug' => 'monitoring-logs', 'path' => '/monitoring/logs', 'label_key' => 'monitoring_logs', 'permission' => 'monitoring.manage'],
                    ['slug' => 'monitoring-uptime', 'path' => '/monitoring/uptime', 'label_key' => 'monitoring_uptime', 'permission' => 'monitoring.manage'],
                    ['slug' => 'monitoring-channels', 'path' => '/monitoring/channels', 'label_key' => 'monitoring_channels', 'permission' => 'monitoring.manage'],
                ],
            ],
            [
                'id' => 'automation',
                'label_key' => 'section_automation',
                'items' => [
                    ['slug' => 'api-tokens', 'path' => '/api-tokens', 'label_key' => 'api_tokens'],
                    ['slug' => 'webhooks', 'path' => '/webhooks', 'label_key' => 'webhooks', 'permission' => 'webhooks.manage'],
                    ['slug' => 'profile', 'path' => '/profile', 'label_key' => 'profile'],
                ],
            ],
            [
                'id' => 'email',
                'label_key' => 'section_email',
                'items' => [
                    ['slug' => 'email-domains', 'path' => '/email/domains', 'label_key' => 'email_domains'],
                    ['slug' => 'email-auth', 'path' => '/email/auth', 'label_key' => 'email_auth'],
                    ['slug' => 'email-accounts', 'path' => '/email/accounts', 'label_key' => 'email_accounts'],
                    ['slug' => 'email-forwarders', 'path' => '/email/forwarders', 'label_key' => 'email_forwarders'],
                    ['slug' => 'email-autoresponders', 'path' => '/email/autoresponders', 'label_key' => 'email_autoresponders'],
                    ['slug' => 'email-lists', 'path' => '/email/lists', 'label_key' => 'email_lists'],
                    ['slug' => 'email-queue', 'path' => '/email/queue', 'label_key' => 'email_queue'],
                    ['slug' => 'email-antispam', 'path' => '/email/antispam', 'label_key' => 'email_antispam'],
                    ['slug' => 'webmail', 'path' => '/webmail', 'label_key' => 'webmail'],
                ],
            ],
            [
                'id' => 'system',
                'label_key' => 'section_system',
                'items' => [
                    ['slug' => 'files', 'path' => '/files', 'label_key' => 'files'],
                    ['slug' => 'terminal', 'path' => '/terminal', 'label_key' => 'terminal'],
                    ['slug' => 'cron', 'path' => '/cron', 'label_key' => 'cron'],
                    ['slug' => 'backups', 'path' => '/backups', 'label_key' => 'backups'],
                    ['slug' => 'system-info', 'path' => '/system-info', 'label_key' => 'system_info'],
                    ['slug' => 'metrics-alerts', 'path' => '/metrics-alerts', 'label_key' => 'metrics_alerts'],
                ],
            ],
            [
                'id' => 'platform',
                'label_key' => 'section_platform',
                'items' => [
                    ['slug' => 'sites', 'path' => '/sites', 'label_key' => 'sites'],
                    ['slug' => 'products', 'path' => '/products', 'label_key' => 'products'],
                ],
            ],
            [
                'id' => 'advanced',
                'label_key' => 'section_advanced',
                'items' => [
                    ['slug' => 'git', 'path' => '/git', 'label_key' => 'git'],
                    ['slug' => 'wordpress', 'path' => '/wordpress', 'label_key' => 'wordpress'],
                    ['slug' => 'support', 'path' => '/support', 'label_key' => 'support'],
                ],
            ],
        ];

        $user = $request->user();
        $filtered = array_values(array_filter(array_map(function (array $section) use ($user) {
            $items = array_values(array_filter($section['items'], function (array $item) use ($user) {
                $perm = $item['permission'] ?? RoutePermission::forPath($item['path'] ?? '');
                if ($perm === null) {
                    return true;
                }

                return $user?->can($perm) ?? false;
            }));
            if ($items === []) {
                return null;
            }
            $section['items'] = array_map(function (array $item) {
                unset($item['permission']);

                return $item;
            }, $items);

            return $section;
        }, $sections)));

        return response()->json(['sections' => $filtered]);
    }
}
