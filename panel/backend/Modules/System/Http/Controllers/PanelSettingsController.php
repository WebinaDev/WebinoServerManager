<?php

namespace Modules\System\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class PanelSettingsController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->get('/v1/panel/settings');
        $agentSettings = ($result['ok'] ?? false) ? $this->decode($result) : [];

        return response()->json([
            'settings' => [
                'bind_domain' => PanelSetting::getValue('bind_domain', $agentSettings['bind_domain'] ?? null),
                'http_port' => (int) (PanelSetting::getValue('http_port', $agentSettings['http_port'] ?? '2090') ?? 2090),
                'https_port' => (int) (PanelSetting::getValue('https_port', $agentSettings['https_port'] ?? '2090') ?? 2090),
                'ssl_enabled' => filter_var(PanelSetting::getValue('ssl_enabled', $agentSettings['ssl_enabled'] ?? '0'), FILTER_VALIDATE_BOOLEAN),
            ],
            'links' => [
                'profile' => '/profile',
                'two_factor' => '/security/2fa',
                'api_tokens' => '/api-tokens',
            ],
        ]);
    }

    public function updateNetwork(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bind_domain' => ['nullable', 'string', 'max:253'],
            'http_port' => ['required', 'integer', 'min:1', 'max:65535'],
            'https_port' => ['required', 'integer', 'min:1', 'max:65535'],
            'ssl_enabled' => ['required', 'boolean'],
        ]);

        $result = $this->agent->post('/v1/panel/settings', [
            'action' => 'network',
            'bind_domain' => $data['bind_domain'] ?? '',
            'http_port' => $data['http_port'],
            'https_port' => $data['https_port'],
            'ssl_enabled' => $data['ssl_enabled'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('system.panel_network_failed')], 422);
        }

        PanelSetting::setValue('bind_domain', $data['bind_domain'] ?? '');
        PanelSetting::setValue('http_port', (string) $data['http_port']);
        PanelSetting::setValue('https_port', (string) $data['https_port']);
        PanelSetting::setValue('ssl_enabled', $data['ssl_enabled'] ? '1' : '0');

        return response()->json(['message' => __('system.panel_network_updated'), 'agent' => $this->decode($result)]);
    }

    public function restartPanel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'confirm' => ['required', 'string', 'in:RESTART'],
        ]);

        $result = $this->agent->post('/v1/panel/restart', ['confirm' => $data['confirm']]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('system.panel_restart_failed')], 422);
        }

        return response()->json(['message' => __('system.panel_restart_started'), 'agent' => $this->decode($result)]);
    }

    public function rebootOs(Request $request): JsonResponse
    {
        $data = $request->validate([
            'confirm_token' => ['required', 'string', 'size:8'],
        ]);

        $expected = Cache::get('panel:reboot_confirm:'.$request->user()?->id);
        if ($expected === null || ! hash_equals((string) $expected, $data['confirm_token'])) {
            return response()->json(['message' => __('system.reboot_confirm_invalid')], 422);
        }

        Cache::forget('panel:reboot_confirm:'.$request->user()?->id);

        $result = $this->agent->post('/v1/panel/reboot', ['confirm' => 'REBOOT']);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('system.reboot_failed')], 422);
        }

        return response()->json(['message' => __('system.reboot_started'), 'agent' => $this->decode($result)]);
    }

    public function requestRebootConfirm(Request $request): JsonResponse
    {
        $token = Str::upper(Str::random(8));
        Cache::put('panel:reboot_confirm:'.$request->user()?->id, $token, now()->addMinutes(5));

        return response()->json([
            'confirm_token' => $token,
            'expires_in_seconds' => 300,
            'message' => __('system.reboot_confirm_generated'),
        ]);
    }

    public function repair(Request $request): JsonResponse
    {
        $data = $request->validate([
            'steps' => ['array'],
            'steps.*' => ['string', 'in:health_socket,migrate,permission_seed,report'],
        ]);

        $result = $this->agent->post('/v1/panel/repair', [
            'steps' => $data['steps'] ?? ['health_socket', 'migrate', 'permission_seed', 'report'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('system.repair_failed')], 422);
        }

        return response()->json(['message' => __('system.repair_started'), 'report' => $this->decode($result)]);
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
