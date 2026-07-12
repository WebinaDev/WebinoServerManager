<?php

namespace Modules\Webserver\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Webserver\Entities\NginxVhost;

class RedirectController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function store(Request $request, NginxVhost $vhost): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'string', 'max:255'],
            'to' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:3'],
        ]);

        $name = $vhost->config_name ?: str_replace('.', '_', $vhost->fqdn);
        $result = $this->agent->post('/v1/vhosts/'.$name.'/redirects', $data);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('webserver.redirect_failed')], 422);
        }

        $redirects = $vhost->redirects ?? [];
        $redirects[] = $data;
        $vhost->update(['redirects' => $redirects]);

        return response()->json(['vhost' => $vhost->fresh(), 'agent' => $result]);
    }
}
