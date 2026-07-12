<?php

namespace Modules\Domains\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Domains\Entities\HostingDomain;

class DomainController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $local = HostingDomain::query()->orderBy('domain')->get();
        try {
            $agent = $this->agent->get('/v1/domains');
            $remote = $agent['data']['domains'] ?? [];
        } catch (\Throwable) {
            $remote = [];
        }

        return response()->json([
            'domains' => $local,
            'sites' => $remote,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253'],
            'slug' => ['nullable', 'string', 'max:63'],
            'aliases' => ['nullable', 'string'],
        ]);

        $domain = HostingDomain::query()->create([
            'domain' => strtolower($data['domain']),
            'slug' => $data['slug'] ?? null,
            'aliases' => $data['aliases'] ?? null,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/domains', [
            'domain' => $domain->domain,
            'slug' => $domain->slug ?? explode('.', $domain->domain)[0],
            'aliases' => $domain->aliases ?? '',
        ]);

        if (! ($result['ok'] ?? false)) {
            $domain->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('domains.provision_failed'), 'domain' => $domain], 422);
        }

        $domain->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['domain' => $domain->fresh(), 'agent' => $result], 201);
    }

    public function destroy(HostingDomain $domain): JsonResponse
    {
        if ($domain->slug) {
            $this->agent->webina(['site', 'delete', $domain->slug, '--yes']);
        }
        $domain->delete();

        return response()->json(['message' => __('domains.deleted')]);
    }
}
