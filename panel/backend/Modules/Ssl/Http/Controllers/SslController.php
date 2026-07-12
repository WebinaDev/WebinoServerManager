<?php

namespace Modules\Ssl\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Ssl\Entities\SslCertificate;

class SslController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'certificates' => SslCertificate::query()->orderBy('domain')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253', 'unique:ssl_certificates,domain'],
            'auto_renew' => ['nullable', 'boolean'],
            'alert_days' => ['nullable', 'integer', 'min:1', 'max:90'],
        ]);

        $cert = SslCertificate::query()->create([
            'domain' => strtolower($data['domain']),
            'type' => 'letsencrypt',
            'challenge' => 'http',
            'auto_renew' => $data['auto_renew'] ?? true,
            'alert_days' => $data['alert_days'] ?? 14,
            'status' => 'pending',
        ]);

        return $this->provisionCert($cert, 'issue');
    }

    public function renew(SslCertificate $certificate): JsonResponse
    {
        return $this->provisionCert($certificate, 'renew');
    }

    public function issueWildcard(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253', 'unique:ssl_certificates,domain'],
            'auto_renew' => ['nullable', 'boolean'],
            'alert_days' => ['nullable', 'integer', 'min:1', 'max:90'],
        ]);

        $domain = strtolower($data['domain']);
        $cert = SslCertificate::query()->create([
            'domain' => $domain,
            'type' => 'wildcard',
            'sans' => ['*.'.$domain, $domain],
            'challenge' => 'dns',
            'auto_renew' => $data['auto_renew'] ?? true,
            'alert_days' => $data['alert_days'] ?? 14,
            'status' => 'pending',
        ]);

        return $this->provisionCert($cert, 'issue_wildcard');
    }

    public function uploadCustom(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253', 'unique:ssl_certificates,domain'],
            'cert_pem' => ['required', 'string'],
            'key_pem' => ['required', 'string'],
            'chain_pem' => ['nullable', 'string'],
            'auto_renew' => ['nullable', 'boolean'],
            'alert_days' => ['nullable', 'integer', 'min:1', 'max:90'],
        ]);

        $cert = SslCertificate::query()->create([
            'domain' => strtolower($data['domain']),
            'type' => 'custom',
            'challenge' => 'manual',
            'auto_renew' => false,
            'alert_days' => $data['alert_days'] ?? 14,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/ssl/certificates', [
            'domain' => $cert->domain,
            'action' => 'upload_custom',
            'cert_pem' => $data['cert_pem'],
            'key_pem' => $data['key_pem'],
            'chain_pem' => $data['chain_pem'] ?? '',
        ]);

        if (! ($result['ok'] ?? false)) {
            $cert->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('ssl.upload_failed'), 'certificate' => $cert], 422);
        }

        $agentData = $this->agentPayload($result);
        $cert->update([
            'status' => 'active',
            'issuer' => $agentData['issuer'] ?? 'custom',
            'expires_at' => $agentData['expires_at'] ?? null,
            'cert_path' => $agentData['cert_path'] ?? null,
            'key_path' => $agentData['key_path'] ?? null,
            'last_error' => null,
        ]);

        return response()->json(['certificate' => $cert->fresh(), 'agent' => $result], 201);
    }

    public function validateChain(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cert_pem' => ['required', 'string'],
            'key_pem' => ['required', 'string'],
            'chain_pem' => ['nullable', 'string'],
        ]);

        $result = $this->agent->post('/v1/ssl/certificates', array_merge($data, [
            'domain' => 'validate.local',
            'action' => 'validate_chain',
        ]));

        return response()->json(['validation' => $this->agentPayload($result), 'agent' => $result]);
    }

    public function bindService(Request $request, SslCertificate $certificate): JsonResponse
    {
        $data = $request->validate([
            'service' => ['required', 'in:panel,mail'],
        ]);

        $result = $this->agent->post('/v1/ssl/certificates', [
            'domain' => $certificate->domain,
            'action' => 'bind_service',
            'service' => $data['service'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('ssl.bind_failed')], 422);
        }

        $certificate->update(['service_binding' => $data['service']]);

        return response()->json(['certificate' => $certificate->fresh(), 'agent' => $result]);
    }

    public function update(Request $request, SslCertificate $certificate): JsonResponse
    {
        $data = $request->validate([
            'auto_renew' => ['sometimes', 'boolean'],
            'alert_days' => ['sometimes', 'integer', 'min:1', 'max:90'],
            'service_binding' => ['nullable', 'in:panel,mail'],
        ]);

        $certificate->update($data);

        return response()->json(['certificate' => $certificate->fresh()]);
    }

    public function destroy(SslCertificate $certificate): JsonResponse
    {
        $result = $this->agent->post('/v1/ssl/certificates', [
            'domain' => $certificate->domain,
            'action' => 'revoke',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('ssl.revoke_failed')], 422);
        }

        $certificate->delete();

        return response()->json(['message' => __('ssl.deleted')]);
    }

    private function provisionCert(SslCertificate $cert, string $action): JsonResponse
    {
        $result = $this->agent->post('/v1/ssl/certificates', [
            'domain' => $cert->domain,
            'action' => $action,
        ]);

        if (! ($result['ok'] ?? false)) {
            $cert->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);
            $message = match ($action) {
                'renew' => __('ssl.renew_failed'),
                'issue_wildcard' => __('ssl.wildcard_failed'),
                default => __('ssl.issue_failed'),
            };

            return response()->json(['message' => $result['error'] ?? $message, 'certificate' => $cert], 422);
        }

        $agentData = $this->agentPayload($result);
        $cert->update([
            'status' => 'active',
            'issuer' => $agentData['issuer'] ?? "Let's Encrypt",
            'expires_at' => $agentData['expires_at'] ?? null,
            'cert_path' => $agentData['cert_path'] ?? null,
            'key_path' => $agentData['key_path'] ?? null,
            'last_error' => null,
            'last_renewed_at' => $action === 'renew' ? now() : $cert->last_renewed_at,
        ]);

        $code = $action === 'renew' ? 200 : 201;

        return response()->json(['certificate' => $cert->fresh(), 'agent' => $result], $code);
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function agentPayload(array $result): array
    {
        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($data) ? $data : [];
    }
}
