<?php

namespace Modules\Subdomains\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Subdomains\Entities\HostingSubdomain;

class SubdomainController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'subdomains' => HostingSubdomain::query()->orderBy('fqdn')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'parent_domain' => ['required', 'string', 'max:253'],
            'subdomain' => ['required', 'string', 'max:63', 'regex:/^[a-zA-Z0-9-]+$/'],
            'document_root' => ['nullable', 'string', 'max:255'],
            'php_pool' => ['nullable', 'string', 'max:64'],
            'ssl_enabled' => ['nullable', 'boolean'],
            'force_https' => ['nullable', 'boolean'],
        ]);

        $parent = strtolower($data['parent_domain']);
        $label = strtolower($data['subdomain']);
        $fqdn = $label.'.'.$parent;
        $docRoot = $data['document_root'] ?? 'sites/'.$fqdn.'/public';

        $record = HostingSubdomain::query()->create([
            'parent_domain' => $parent,
            'subdomain' => $label,
            'fqdn' => $fqdn,
            'document_root' => ltrim($docRoot, '/'),
            'php_pool' => $data['php_pool'] ?? null,
            'ssl_enabled' => $data['ssl_enabled'] ?? false,
            'force_https' => $data['force_https'] ?? false,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/subdomains', [
            'action' => 'create',
            'fqdn' => $fqdn,
            'parent_domain' => $parent,
            'subdomain' => $label,
            'document_root' => $record->document_root,
            'php_pool' => $record->php_pool,
            'ssl' => $record->ssl_enabled,
            'force_https' => $record->force_https,
        ]);

        if (! ($result['ok'] ?? false)) {
            $record->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('subdomains.create_failed'), 'subdomain' => $record], 422);
        }

        $record->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['subdomain' => $record->fresh(), 'agent' => $result], 201);
    }

    public function destroy(HostingSubdomain $subdomain): JsonResponse
    {
        $this->agent->post('/v1/subdomains', [
            'action' => 'delete',
            'fqdn' => $subdomain->fqdn,
            'document_root' => $subdomain->document_root,
        ]);
        $subdomain->delete();

        return response()->json(['message' => __('subdomains.deleted')]);
    }
}
