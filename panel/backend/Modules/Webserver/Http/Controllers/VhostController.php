<?php

namespace Modules\Webserver\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Webserver\Entities\NginxVhost;

class VhostController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $vhosts = NginxVhost::query()->orderBy('fqdn')->get();
        $agent = $this->agent->get('/v1/vhosts');
        $live = [];
        if ($agent['ok'] ?? false) {
            $data = $agent['data'] ?? [];
            if (is_string($data)) {
                $data = json_decode($data, true) ?? [];
            }
            $live = $data['vhosts'] ?? [];
        }

        return response()->json(['vhosts' => $vhosts, 'live_vhosts' => $live]);
    }

    public function show(NginxVhost $vhost): JsonResponse
    {
        $name = $vhost->config_name ?: str_replace('.', '_', $vhost->fqdn);
        $result = $this->agent->get('/v1/vhosts/'.$name);
        $content = '';
        if ($result['ok'] ?? false) {
            $data = $result['data'] ?? [];
            if (is_string($data)) {
                $data = json_decode($data, true) ?? [];
            }
            $content = $data['content'] ?? '';
        }

        return response()->json(['vhost' => $vhost, 'content' => $content]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fqdn' => ['required', 'string', 'max:253', 'unique:nginx_vhosts,fqdn'],
            'document_root' => ['nullable', 'string', 'max:255'],
            'content' => ['nullable', 'string'],
            'php_pool' => ['nullable', 'string', 'max:64'],
            'ssl_enabled' => ['nullable', 'boolean'],
            'force_https' => ['nullable', 'boolean'],
            'hsts' => ['nullable', 'boolean'],
            'engine' => ['nullable', 'in:nginx,apache'],
            'http3' => ['nullable', 'boolean'],
        ]);

        $fqdn = strtolower($data['fqdn']);
        $configName = str_replace('.', '_', $fqdn);
        $docRoot = $data['document_root'] ?? 'sites/'.$fqdn.'/public';
        $engine = $data['engine'] ?? 'nginx';
        $http3 = $engine === 'nginx' && (bool) ($data['http3'] ?? false);

        $vhost = NginxVhost::query()->create([
            'fqdn' => $fqdn,
            'config_name' => $configName,
            'engine' => $engine,
            'document_root' => ltrim($docRoot, '/'),
            'php_pool' => $data['php_pool'] ?? null,
            'ssl_enabled' => $data['ssl_enabled'] ?? false,
            'force_https' => $data['force_https'] ?? false,
            'hsts' => $data['hsts'] ?? false,
            'http3' => $http3,
            'status' => 'pending',
        ]);

        $payload = [
            'name' => $configName,
            'fqdn' => $fqdn,
            'document_root' => $vhost->document_root,
            'php_pool' => $vhost->php_pool,
            'ssl' => $vhost->ssl_enabled,
            'force_https' => $vhost->force_https,
            'hsts' => $vhost->hsts,
            'http3' => $http3,
            'engine' => $engine,
        ];
        if (! empty($data['content'])) {
            $payload['content'] = $data['content'];
        }

        $result = $this->agent->post('/v1/vhosts', $payload);

        if (! ($result['ok'] ?? false)) {
            $vhost->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('webserver.provision_failed'), 'vhost' => $vhost], 422);
        }

        $vhost->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['vhost' => $vhost->fresh(), 'agent' => $result], 201);
    }

    public function update(Request $request, NginxVhost $vhost): JsonResponse
    {
        $data = $request->validate([
            'content' => ['required', 'string'],
        ]);

        $name = $vhost->config_name ?: str_replace('.', '_', $vhost->fqdn);
        $result = $this->agent->post('/v1/vhosts', [
            'name' => $name,
            'content' => $data['content'],
        ]);

        if (! ($result['ok'] ?? false)) {
            $vhost->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('webserver.save_failed'), 'vhost' => $vhost], 422);
        }

        $vhost->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['vhost' => $vhost->fresh(), 'agent' => $result]);
    }

    public function destroy(NginxVhost $vhost): JsonResponse
    {
        $name = $vhost->config_name ?: str_replace('.', '_', $vhost->fqdn);
        $this->agent->delete('/v1/vhosts/'.$name);
        $vhost->delete();

        return response()->json(['message' => __('webserver.deleted')]);
    }

    public function enableSsl(NginxVhost $vhost): JsonResponse
    {
        $name = $vhost->config_name ?: str_replace('.', '_', $vhost->fqdn);
        $result = $this->agent->post('/v1/vhosts/'.$name.'/ssl', []);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('webserver.ssl_failed')], 422);
        }

        $vhost->update(['ssl_enabled' => true]);

        return response()->json(['vhost' => $vhost->fresh(), 'agent' => $result]);
    }

    public function enableHsts(NginxVhost $vhost): JsonResponse
    {
        $name = $vhost->config_name ?: str_replace('.', '_', $vhost->fqdn);
        $result = $this->agent->post('/v1/vhosts/'.$name.'/hsts', []);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('webserver.hsts_failed')], 422);
        }

        $vhost->update(['hsts' => true]);

        return response()->json(['vhost' => $vhost->fresh(), 'agent' => $result]);
    }
}
