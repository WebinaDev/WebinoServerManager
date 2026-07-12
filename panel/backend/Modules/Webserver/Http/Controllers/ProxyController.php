<?php

namespace Modules\Webserver\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Webserver\Entities\NginxVhost;

class ProxyController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function store(Request $request, NginxVhost $vhost): JsonResponse
    {
        $data = $request->validate([
            'target' => ['required', 'string', 'max:255'],
        ]);

        $name = $vhost->config_name ?: str_replace('.', '_', $vhost->fqdn);
        $result = $this->agent->post('/v1/vhosts/'.$name.'/proxy', $data);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('webserver.proxy_failed')], 422);
        }

        $rules = $vhost->proxy_rules ?? [];
        $rules[] = $data;
        $vhost->update(['proxy_rules' => $rules]);

        return response()->json(['vhost' => $vhost->fresh(), 'agent' => $result]);
    }
}
