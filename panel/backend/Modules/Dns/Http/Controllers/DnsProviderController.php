<?php

namespace Modules\Dns\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Dns\Entities\DnsProvider;

class DnsProviderController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function show(): JsonResponse
    {
        $provider = DnsProvider::query()->where('provider', 'cloudflare')->first();

        return response()->json([
            'provider' => $provider ? [
                'id' => $provider->id,
                'provider' => $provider->provider,
                'default_zone_id' => $provider->default_zone_id,
                'enabled' => $provider->enabled,
                'has_token' => $provider->has_token,
            ] : null,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'api_token' => ['nullable', 'string', 'max:512'],
            'default_zone_id' => ['nullable', 'string', 'max:64'],
            'enabled' => ['boolean'],
        ]);

        $provider = DnsProvider::query()->firstOrCreate(['provider' => 'cloudflare']);

        if (array_key_exists('api_token', $data) && $data['api_token'] !== null && $data['api_token'] !== '') {
            $provider->api_token = $data['api_token'];
        }
        if (array_key_exists('default_zone_id', $data)) {
            $provider->default_zone_id = $data['default_zone_id'];
        }
        if (array_key_exists('enabled', $data)) {
            $provider->enabled = $data['enabled'];
        }
        $provider->save();

        $result = $this->agent->post('/v1/dns/providers/cloudflare', [
            'action' => 'configure',
            'enabled' => $provider->enabled,
            'api_token' => $data['api_token'] ?? null,
            'default_zone_id' => $provider->default_zone_id,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.provider_configure_failed')], 422);
        }

        return response()->json([
            'provider' => [
                'id' => $provider->id,
                'provider' => $provider->provider,
                'default_zone_id' => $provider->default_zone_id,
                'enabled' => $provider->enabled,
                'has_token' => $provider->has_token,
            ],
            'message' => __('dns.provider_updated'),
        ]);
    }

    public function syncSiteRecords(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253'],
            'zone_id' => ['nullable', 'string', 'max:64'],
            'records' => ['required', 'array', 'min:1'],
            'records.*.type' => ['required', 'string', 'max:16'],
            'records.*.name' => ['required', 'string', 'max:253'],
            'records.*.content' => ['required', 'string', 'max:512'],
            'records.*.proxied' => ['boolean'],
        ]);

        $provider = DnsProvider::query()->where('provider', 'cloudflare')->where('enabled', true)->first();
        if ($provider === null || ! $provider->has_token) {
            return response()->json(['message' => __('dns.provider_not_configured')], 422);
        }

        $token = decrypt($provider->getAttributes()['api_token_encrypted']);

        $result = $this->agent->post('/v1/dns/providers/cloudflare', [
            'action' => 'sync_records',
            'domain' => strtolower($data['domain']),
            'zone_id' => $data['zone_id'] ?? $provider->default_zone_id,
            'api_token' => $token,
            'records' => $data['records'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.sync_failed')], 422);
        }

        return response()->json(['message' => __('dns.sync_started'), 'agent' => $this->decode($result)]);
    }

    public function dns01Challenge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253'],
            'record_name' => ['required', 'string', 'max:253'],
            'record_value' => ['required', 'string', 'max:512'],
            'zone_id' => ['nullable', 'string', 'max:64'],
        ]);

        $provider = DnsProvider::query()->where('provider', 'cloudflare')->where('enabled', true)->first();
        if ($provider === null || ! $provider->has_token) {
            return response()->json(['message' => __('dns.provider_not_configured')], 422);
        }

        $token = decrypt($provider->getAttributes()['api_token_encrypted']);

        $result = $this->agent->post('/v1/dns/providers/cloudflare', [
            'action' => 'dns01',
            'domain' => strtolower($data['domain']),
            'zone_id' => $data['zone_id'] ?? $provider->default_zone_id,
            'api_token' => $token,
            'record_name' => $data['record_name'],
            'record_value' => $data['record_value'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.dns01_failed')], 422);
        }

        return response()->json(['message' => __('dns.dns01_created'), 'agent' => $this->decode($result)]);
    }

    public function showAlidns(): JsonResponse
    {
        $provider = DnsProvider::query()->where('provider', 'alidns')->first();

        return response()->json([
            'provider' => $provider ? [
                'id' => $provider->id,
                'provider' => $provider->provider,
                'default_zone_id' => $provider->default_zone_id,
                'enabled' => $provider->enabled,
                'has_token' => $provider->has_token,
            ] : null,
        ]);
    }

    public function updateAlidns(Request $request): JsonResponse
    {
        $data = $request->validate([
            'api_token' => ['nullable', 'string', 'max:512'],
            'default_zone_id' => ['nullable', 'string', 'max:64'],
            'enabled' => ['boolean'],
        ]);

        $provider = DnsProvider::query()->firstOrCreate(['provider' => 'alidns']);

        if (array_key_exists('api_token', $data) && $data['api_token'] !== null && $data['api_token'] !== '') {
            $provider->api_token = $data['api_token'];
        }
        if (array_key_exists('default_zone_id', $data)) {
            $provider->default_zone_id = $data['default_zone_id'];
        }
        if (array_key_exists('enabled', $data)) {
            $provider->enabled = $data['enabled'];
        }
        $provider->save();

        $result = $this->agent->post('/v1/dns/providers/alidns', [
            'action' => 'configure',
            'enabled' => $provider->enabled,
            'api_token' => $data['api_token'] ?? null,
            'zone_id' => $provider->default_zone_id,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.provider_configure_failed')], 422);
        }

        return response()->json([
            'provider' => [
                'id' => $provider->id,
                'provider' => $provider->provider,
                'default_zone_id' => $provider->default_zone_id,
                'enabled' => $provider->enabled,
                'has_token' => $provider->has_token,
            ],
            'message' => __('dns.provider_updated'),
        ]);
    }

    public function syncAlidnsSiteRecords(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253'],
            'zone_id' => ['nullable', 'string', 'max:64'],
            'records' => ['required', 'array', 'min:1'],
            'records.*.type' => ['required', 'string', 'max:16'],
            'records.*.name' => ['required', 'string', 'max:253'],
            'records.*.content' => ['required', 'string', 'max:512'],
            'records.*.proxied' => ['boolean'],
        ]);

        $provider = DnsProvider::query()->where('provider', 'alidns')->where('enabled', true)->first();
        if ($provider === null || ! $provider->has_token) {
            return response()->json(['message' => __('dns.provider_not_configured')], 422);
        }

        $token = decrypt($provider->getAttributes()['api_token_encrypted']);

        $result = $this->agent->post('/v1/dns/providers/alidns', [
            'action' => 'sync_records',
            'domain' => strtolower($data['domain']),
            'zone_id' => $data['zone_id'] ?? $provider->default_zone_id,
            'api_token' => $token,
            'records' => $data['records'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.sync_failed')], 422);
        }

        return response()->json(['message' => __('dns.sync_started'), 'agent' => $this->decode($result)]);
    }

    public function dns01AlidnsChallenge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253'],
            'record_name' => ['required', 'string', 'max:253'],
            'record_value' => ['required', 'string', 'max:512'],
            'zone_id' => ['nullable', 'string', 'max:64'],
        ]);

        $provider = DnsProvider::query()->where('provider', 'alidns')->where('enabled', true)->first();
        if ($provider === null || ! $provider->has_token) {
            return response()->json(['message' => __('dns.provider_not_configured')], 422);
        }

        $token = decrypt($provider->getAttributes()['api_token_encrypted']);

        $result = $this->agent->post('/v1/dns/providers/alidns', [
            'action' => 'dns01',
            'domain' => strtolower($data['domain']),
            'zone_id' => $data['zone_id'] ?? $provider->default_zone_id,
            'api_token' => $token,
            'record_name' => $data['record_name'],
            'record_value' => $data['record_value'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.dns01_failed')], 422);
        }

        return response()->json(['message' => __('dns.dns01_created'), 'agent' => $this->decode($result)]);
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function decode(array $result): array
    {
        $payload = $result['data'] ?? [];
        if (is_string($payload)) {
            $decoded = json_decode($payload, true);

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($payload) ? $payload : [];
    }
}
