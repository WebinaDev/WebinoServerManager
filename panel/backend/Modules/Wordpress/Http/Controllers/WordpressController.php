<?php

namespace Modules\Wordpress\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Modules\Wordpress\Entities\WordpressSite;

class WordpressController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'sites' => WordpressSite::query()->orderByDesc('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253'],
            'path' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'admin_user' => ['required', 'string', 'max:64'],
            'admin_password' => ['required', 'string', 'min:8'],
            'admin_email' => ['nullable', 'email', 'max:255'],
            'db_name' => ['nullable', 'string', 'max:64'],
            'db_user' => ['nullable', 'string', 'max:64'],
            'db_password' => ['nullable', 'string', 'max:128'],
            'db_host' => ['nullable', 'string', 'max:128'],
        ]);

        $site = WordpressSite::query()->create([
            'domain' => strtolower($data['domain']),
            'path' => ltrim($data['path'], '/'),
            'title' => $data['title'],
            'admin_user' => $data['admin_user'],
            'admin_password_encrypted' => Crypt::encryptString($data['admin_password']),
            'admin_email' => $data['admin_email'] ?? null,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/wordpress', [
            'action' => 'install',
            'domain' => $site->domain,
            'path' => $site->path,
            'title' => $site->title,
            'admin_user' => $site->admin_user,
            'admin_password' => $data['admin_password'],
            'admin_email' => $site->admin_email ?? 'admin@'.$site->domain,
            'db_name' => $data['db_name'] ?? null,
            'db_user' => $data['db_user'] ?? config('database.connections.mysql.username'),
            'db_password' => $data['db_password'] ?? config('database.connections.mysql.password'),
            'db_host' => $data['db_host'] ?? config('database.connections.mysql.host'),
        ]);

        if (! ($result['ok'] ?? false)) {
            $site->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('wordpress.install_failed'), 'site' => $site], 422);
        }

        $site->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['site' => $site->fresh(), 'agent' => $result], 201);
    }

    public function destroy(WordpressSite $site): JsonResponse
    {
        $this->agent->post('/v1/wordpress', [
            'action' => 'delete',
            'path' => $site->path,
        ]);
        $site->delete();

        return response()->json(['message' => __('wordpress.deleted')]);
    }

    public function cloneSite(Request $request, WordpressSite $site): JsonResponse
    {
        $data = $request->validate([
            'target_path' => ['required', 'string', 'max:255'],
        ]);

        return $this->agentAction($site, 'clone', [
            'source_path' => $site->path,
            'target_path' => ltrim($data['target_path'], '/'),
        ]);
    }

    public function migrate(Request $request, WordpressSite $site): JsonResponse
    {
        $data = $request->validate([
            'old_url' => ['required', 'string', 'max:512'],
            'new_url' => ['required', 'string', 'max:512'],
        ]);

        return $this->agentAction($site, 'migrate', [
            'old_url' => $data['old_url'],
            'new_url' => $data['new_url'],
        ]);
    }

    public function staging(Request $request, WordpressSite $site): JsonResponse
    {
        $data = $request->validate([
            'staging_domain' => ['required', 'string', 'max:253'],
            'target_path' => ['nullable', 'string', 'max:255'],
        ]);

        $payload = [
            'source_path' => $site->path,
            'staging_domain' => strtolower($data['staging_domain']),
        ];
        if (! empty($data['target_path'])) {
            $payload['target_path'] = ltrim($data['target_path'], '/');
        }

        return $this->agentAction($site, 'staging', $payload);
    }

    public function themes(WordpressSite $site): JsonResponse
    {
        $result = $this->agent->post('/v1/wordpress', [
            'action' => 'themes_list',
            'path' => $site->path,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('wordpress.themes_failed')], 422);
        }

        return response()->json(['themes' => $this->decodeAgentData($result)['themes'] ?? []]);
    }

    public function updateThemes(Request $request, WordpressSite $site): JsonResponse
    {
        $data = $request->validate([
            'theme_slug' => ['nullable', 'string', 'max:128'],
            'all' => ['nullable', 'boolean'],
        ]);

        return $this->agentAction($site, 'themes_update', [
            'theme_slug' => $data['theme_slug'] ?? '',
            'all' => $request->boolean('all'),
        ]);
    }

    public function plugins(WordpressSite $site): JsonResponse
    {
        $result = $this->agent->post('/v1/wordpress', [
            'action' => 'plugins_list',
            'path' => $site->path,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('wordpress.plugins_failed')], 422);
        }

        return response()->json(['plugins' => $this->decodeAgentData($result)['plugins'] ?? []]);
    }

    public function updatePlugins(Request $request, WordpressSite $site): JsonResponse
    {
        $data = $request->validate([
            'plugin_slug' => ['nullable', 'string', 'max:128'],
            'all' => ['nullable', 'boolean'],
        ]);

        return $this->agentAction($site, 'plugins_update', [
            'plugin_slug' => $data['plugin_slug'] ?? '',
            'all' => $request->boolean('all'),
        ]);
    }

    public function integrity(WordpressSite $site): JsonResponse
    {
        $result = $this->agent->post('/v1/wordpress', [
            'action' => 'integrity',
            'path' => $site->path,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('wordpress.integrity_failed')], 422);
        }

        return response()->json(['integrity' => $this->decodeAgentData($result)]);
    }

    /** @param array<string, mixed> $extra */
    private function agentAction(WordpressSite $site, string $action, array $extra = []): JsonResponse
    {
        $payload = array_merge(['action' => $action, 'path' => $site->path], $extra);
        $result = $this->agent->post('/v1/wordpress', $payload);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('wordpress.action_failed'), 'site' => $site], 422);
        }

        return response()->json(['site' => $site, 'agent' => $this->decodeAgentData($result)]);
    }

    /** @param array<string, mixed> $result
     * @return array<string, mixed>
     */
    private function decodeAgentData(array $result): array
    {
        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($data) ? $data : [];
    }
}
