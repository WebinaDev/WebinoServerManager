<?php

namespace Modules\Websites\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Websites\Entities\HostingWebsite;
use Modules\Websites\Services\WebsiteProvisioner;
use RuntimeException;

class WebsiteController extends Controller
{
    public function __construct(
        private readonly WebsiteProvisioner $provisioner,
        private readonly AgentClient $agent,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'websites' => HostingWebsite::query()
                ->with(['vhost:id,fqdn,status', 'ftpAccount:id,username', 'database:id,name,engine'])
                ->orderBy('fqdn')
                ->get(),
        ]);
    }

    public function rewriteTemplates(): JsonResponse
    {
        return response()->json([
            'templates' => [
                ['id' => 'none', 'label' => 'Default (static)'],
                ['id' => 'wordpress', 'label' => 'WordPress'],
                ['id' => 'laravel', 'label' => 'Laravel'],
                ['id' => 'custom', 'label' => 'Custom try_files'],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fqdn' => ['required', 'string', 'max:253', 'unique:hosting_websites,fqdn', 'unique:nginx_vhosts,fqdn'],
            'aliases' => ['nullable'],
            'type' => ['nullable', 'in:php,static,proxy'],
            'engine' => ['nullable', 'in:nginx,apache'],
            'http3' => ['nullable', 'boolean'],
            'document_root' => ['nullable', 'string', 'max:255'],
            'php_pool' => ['nullable', 'string', 'max:64'],
            'php_version' => ['nullable', 'string', 'max:8'],
            'create_php_pool' => ['nullable', 'boolean'],
            'ssl_enabled' => ['nullable', 'boolean'],
            'force_https' => ['nullable', 'boolean'],
            'hsts' => ['nullable', 'boolean'],
            'hotlink_protect' => ['nullable', 'boolean'],
            'issue_ssl' => ['nullable', 'boolean'],
            'rewrite_template' => ['nullable', 'in:none,wordpress,laravel,custom'],
            'rewrite_custom' => ['nullable', 'string', 'max:2000'],
            'deny_paths' => ['nullable'],
            'traffic_limit_mb' => ['nullable', 'integer', 'min:1', 'max:102400'],
            'proxy_pass' => ['nullable', 'string', 'max:512'],
            'hosting_account_id' => ['nullable', 'integer', 'exists:hosting_accounts,id'],
            'create_ftp' => ['nullable', 'boolean'],
            'ftp_username' => ['nullable', 'string', 'max:32', 'regex:/^[a-zA-Z0-9_]+$/'],
            'ftp_password' => ['nullable', 'string', 'min:8'],
            'create_database' => ['nullable', 'boolean'],
            'database_name' => ['nullable', 'string', 'max:64', 'regex:/^[a-zA-Z0-9_]+$/'],
        ]);

        try {
            $result = $this->provisioner->create($data);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage() ?: __('websites.provision_failed')], 422);
        }

        return response()->json([
            'website' => $result['website'],
            'credentials' => $result['credentials'] ?? null,
        ], 201);
    }

    public function show(HostingWebsite $website): JsonResponse
    {
        return response()->json([
            'website' => $website->load(['vhost', 'ftpAccount', 'database', 'hostingAccount']),
        ]);
    }

    public function update(Request $request, HostingWebsite $website): JsonResponse
    {
        $data = $request->validate([
            'aliases' => ['nullable'],
            'type' => ['nullable', 'in:php,static,proxy'],
            'engine' => ['nullable', 'in:nginx,apache'],
            'http3' => ['nullable', 'boolean'],
            'document_root' => ['nullable', 'string', 'max:255'],
            'php_pool' => ['nullable', 'string', 'max:64'],
            'php_version' => ['nullable', 'string', 'max:8'],
            'ssl_enabled' => ['nullable', 'boolean'],
            'force_https' => ['nullable', 'boolean'],
            'hsts' => ['nullable', 'boolean'],
            'hotlink_protect' => ['nullable', 'boolean'],
            'rewrite_template' => ['nullable', 'in:none,wordpress,laravel,custom'],
            'rewrite_custom' => ['nullable', 'string', 'max:2000'],
            'deny_paths' => ['nullable'],
            'traffic_limit_mb' => ['nullable', 'integer', 'min:1', 'max:102400'],
            'proxy_pass' => ['nullable', 'string', 'max:512'],
            'hosting_account_id' => ['nullable', 'integer', 'exists:hosting_accounts,id'],
        ]);

        try {
            $website = $this->provisioner->update($website, $data);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage() ?: __('websites.update_failed'), 'website' => $website->fresh()], 422);
        }

        return response()->json(['website' => $website]);
    }

    public function destroy(Request $request, HostingWebsite $website): JsonResponse
    {
        $data = $request->validate([
            'delete_ftp' => ['nullable', 'boolean'],
            'delete_database' => ['nullable', 'boolean'],
        ]);

        $this->provisioner->destroy(
            $website,
            (bool) ($data['delete_ftp'] ?? false),
            (bool) ($data['delete_database'] ?? false),
        );

        return response()->json(['message' => __('websites.deleted')]);
    }

    public function htpasswd(Request $request, HostingWebsite $website): JsonResponse
    {
        $data = $request->validate([
            'user' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'min:4'],
            'path' => ['nullable', 'string', 'max:255'],
        ]);

        $result = $this->agent->post('/v1/vhosts/'.$website->configName().'/htpasswd', [
            'user' => $data['user'],
            'password' => $data['password'],
            'path' => $data['path'] ?? '/',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('websites.htpasswd_failed')], 422);
        }

        return response()->json(['message' => __('websites.htpasswd_ok'), 'agent' => $result]);
    }

    public function logs(Request $request, HostingWebsite $website): JsonResponse
    {
        $data = $request->validate([
            'type' => ['nullable', 'in:access,error'],
            'lines' => ['nullable', 'integer', 'min:1', 'max:5000'],
        ]);
        $type = $data['type'] ?? 'access';
        $source = 'vhost-'.$type.':'.$website->fqdn;
        $lines = $data['lines'] ?? 200;

        $result = $this->agent->get('/v1/logs?source='.urlencode($source).'&lines='.$lines);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('websites.logs_failed'), 'content' => ''], 422);
        }

        $payload = $result['data'] ?? [];
        if (is_string($payload)) {
            $payload = json_decode($payload, true) ?? [];
        }

        return response()->json([
            'source' => $source,
            'content' => $payload['content'] ?? '',
        ]);
    }

    public function analytics(HostingWebsite $website): JsonResponse
    {
        $result = $this->agent->get('/v1/websites/analytics?fqdn='.urlencode($website->fqdn));
        $payload = $result['data'] ?? [];
        if (is_string($payload)) {
            $payload = json_decode($payload, true) ?? [];
        }

        return response()->json(
            is_array($payload) ? $payload : [],
            ($result['ok'] ?? false) ? 200 : 422
        );
    }

    public function composer(Request $request, HostingWebsite $website): JsonResponse
    {
        $data = $request->validate([
            'command' => ['nullable', 'in:install,update'],
        ]);

        $result = $this->agent->post('/v1/websites/composer', [
            'document_root' => $website->document_root,
            'command' => $data['command'] ?? 'install',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('websites.composer_failed')], 422);
        }

        return response()->json(['message' => __('websites.composer_ok'), 'agent' => $result]);
    }
}
