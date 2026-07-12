<?php

namespace Modules\Apps\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Modules\Apps\Entities\DockerApp;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Services\HostingQuota;

class AppController extends Controller
{
    public function __construct(
        private readonly AgentClient $agent,
        private readonly HostingQuota $quota,
    ) {}

    public function index(): JsonResponse
    {
        $apps = DockerApp::query()->orderBy('name')->get();
        $agentList = $this->agent->get('/v1/docker/containers');
        $live = [];
        if ($agentList['ok'] ?? false) {
            $data = $this->agentPayload($agentList);
            foreach ($data['containers'] ?? [] as $row) {
                if (is_array($row) && isset($row['name'])) {
                    $live[$row['name']] = $row;
                }
            }
        }

        $merged = $apps->map(function (DockerApp $app) use ($live) {
            $row = $app->toArray();
            if (isset($live[$app->name])) {
                $row['live_status'] = $live[$app->name]['status'] ?? null;
            }

            return $row;
        });

        return response()->json(['apps' => $merged]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/', 'unique:docker_apps,name'],
            'image' => ['required', 'string', 'max:255'],
            'ports' => ['nullable', 'array'],
            'ports.*' => ['string', 'max:64'],
            'env' => ['nullable', 'array'],
            'volumes' => ['nullable', 'array'],
            'volumes.*' => ['string', 'max:512'],
            'restart_policy' => ['nullable', 'string', 'max:32'],
            'proxy_domain' => ['nullable', 'string', 'max:253'],
            'proxy_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'hosting_account_id' => ['nullable', 'exists:hosting_accounts,id'],
            'command' => ['nullable', 'string', 'max:512'],
        ]);

        if (! empty($data['hosting_account_id'])) {
            $account = HostingAccount::query()->findOrFail($data['hosting_account_id']);
            $this->quota->assert($account, 'apps');
        }

        $app = DockerApp::query()->create([
            'name' => $data['name'],
            'image' => $data['image'],
            'ports' => $data['ports'] ?? [],
            'env_encrypted' => isset($data['env']) ? Crypt::encryptString(json_encode($data['env'])) : null,
            'volumes' => $data['volumes'] ?? [],
            'restart_policy' => $data['restart_policy'] ?? 'unless-stopped',
            'proxy_domain' => $data['proxy_domain'] ?? null,
            'proxy_port' => $data['proxy_port'] ?? null,
            'hosting_account_id' => $data['hosting_account_id'] ?? null,
            'status' => 'pending',
        ]);

        $payload = [
            'action' => 'run',
            'name' => $app->name,
            'image' => $app->image,
            'ports' => $app->ports ?? [],
            'env' => $data['env'] ?? [],
            'volumes' => $app->volumes ?? [],
            'restart_policy' => $app->restart_policy,
            'command' => $data['command'] ?? '',
        ];

        $result = $this->agent->post('/v1/docker/containers', $payload);

        if (! ($result['ok'] ?? false)) {
            $app->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('apps.run_failed'), 'app' => $app], 422);
        }

        $agentData = $this->agentPayload($result);
        $app->update([
            'container_id' => $agentData['container_id'] ?? null,
            'status' => 'active',
            'last_error' => null,
        ]);

        if ($app->proxy_domain && $app->proxy_port) {
            $this->agent->post('/v1/vhosts', [
                'name' => str_replace('.', '_', $app->proxy_domain),
                'fqdn' => $app->proxy_domain,
                'proxy_pass' => 'http://127.0.0.1:'.$app->proxy_port,
            ]);
        }

        return response()->json(['app' => $app->fresh(), 'agent' => $agentData], 201);
    }

    public function start(DockerApp $app): JsonResponse
    {
        return $this->containerAction($app, 'start');
    }

    public function stop(DockerApp $app): JsonResponse
    {
        return $this->containerAction($app, 'stop');
    }

    public function restart(DockerApp $app): JsonResponse
    {
        return $this->containerAction($app, 'restart');
    }

    public function logs(Request $request, DockerApp $app): JsonResponse
    {
        $tail = (int) $request->query('tail', 100);
        $result = $this->agent->post('/v1/docker/containers', [
            'action' => 'logs',
            'name' => $app->name,
            'tail' => $tail,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('apps.logs_failed')], 422);
        }

        return response()->json(['logs' => $this->agentPayload($result)]);
    }

    public function destroy(DockerApp $app): JsonResponse
    {
        $this->agent->post('/v1/docker/containers', [
            'action' => 'remove',
            'name' => $app->name,
        ]);

        if ($app->proxy_domain) {
            $vhostName = str_replace('.', '_', $app->proxy_domain);
            $this->agent->post('/v1/vhosts/'.$vhostName, ['action' => 'delete']);
        }

        $app->delete();

        return response()->json(['message' => __('apps.deleted')]);
    }

    private function containerAction(DockerApp $app, string $action): JsonResponse
    {
        $result = $this->agent->post('/v1/docker/containers', [
            'action' => $action,
            'name' => $app->name,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('apps.action_failed')], 422);
        }

        return response()->json(['app' => $app->fresh(), 'agent' => $this->agentPayload($result)]);
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
