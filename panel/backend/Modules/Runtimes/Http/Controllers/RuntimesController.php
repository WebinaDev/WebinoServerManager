<?php

namespace Modules\Runtimes\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Runtimes\Entities\RuntimeProject;
use Modules\Runtimes\Entities\RuntimeVersion;
use Modules\Runtimes\Jobs\InstallRuntimeVersionJob;

class RuntimesController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function versions(): JsonResponse
    {
        $versions = RuntimeVersion::query()->orderBy('runtime')->orderBy('name')->get();
        $agentStatus = [];
        try {
            $res = $this->agent->get('/v1/runtimes/status');
            $agentStatus = $this->decodeAgentData($res);
        } catch (\Throwable) {
            $agentStatus = [];
        }
        $runtimes = is_array($agentStatus['runtimes'] ?? null) ? $agentStatus['runtimes'] : [];

        $rows = $versions->map(function (RuntimeVersion $v) use ($runtimes) {
            $probe = $runtimes[$v->runtime] ?? null;

            return [
                'id' => $v->id,
                'slug' => $v->slug,
                'runtime' => $v->runtime,
                'name' => $v->name,
                'install_method' => $v->install_method,
                'version_label' => $v->version_label,
                'status' => $v->status,
                'host_status' => is_array($probe) ? ($probe['status'] ?? 'unknown') : 'unknown',
                'host_version' => is_array($probe) ? ($probe['version'] ?? null) : null,
            ];
        });

        return response()->json(['versions' => $rows]);
    }

    public function installVersion(RuntimeVersion $version): JsonResponse
    {
        $version->update(['status' => 'pending', 'last_error' => null]);
        InstallRuntimeVersionJob::dispatch($version->id);

        return response()->json(['version' => $version->fresh()], 202);
    }

    public function projects(): JsonResponse
    {
        $projects = RuntimeProject::query()->with('version:id,slug,name')->orderBy('name')->get();
        $live = [];
        foreach ($projects as $project) {
            try {
                $res = $this->agent->post('/v1/runtimes/projects', [
                    'action' => 'status',
                    'name' => $project->name,
                ]);
                $data = $this->decodeAgentData($res);
                $live[$project->name] = $data;
            } catch (\Throwable) {
                $live[$project->name] = ['status' => $project->status];
            }
        }

        $rows = $projects->map(function (RuntimeProject $p) use ($live) {
            $row = $p->toArray();
            $row['live_status'] = $live[$p->name]['status'] ?? $p->status;
            $row['live_pid'] = $live[$p->name]['pid'] ?? $p->pid;

            return $row;
        });

        return response()->json(['projects' => $rows]);
    }

    public function storeProject(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/', 'unique:runtimes_projects,name'],
            'runtime' => ['required', 'string', 'in:node,python,go,java'],
            'runtime_version_id' => ['nullable', 'exists:runtimes_versions,id'],
            'work_dir' => ['required', 'string', 'max:255'],
            'entry_script' => ['nullable', 'string', 'max:128'],
            'npm_script' => ['nullable', 'string', 'max:64'],
            'port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'autostart' => ['nullable', 'boolean'],
        ]);

        $project = RuntimeProject::query()->create([
            'name' => $data['name'],
            'runtime' => $data['runtime'],
            'runtime_version_id' => $data['runtime_version_id'] ?? null,
            'work_dir' => ltrim($data['work_dir'], '/'),
            'entry_script' => $data['entry_script'] ?? null,
            'npm_script' => $data['npm_script'] ?? null,
            'port' => $data['port'] ?? null,
            'status' => 'stopped',
        ]);

        if ($request->boolean('autostart')) {
            return $this->projectAction($project, 'start');
        }

        return response()->json(['project' => $project->fresh()], 201);
    }

    public function start(RuntimeProject $project): JsonResponse
    {
        return $this->projectAction($project, 'start');
    }

    public function stop(RuntimeProject $project): JsonResponse
    {
        return $this->projectAction($project, 'stop');
    }

    public function restart(RuntimeProject $project): JsonResponse
    {
        return $this->projectAction($project, 'restart');
    }

    public function logs(Request $request, RuntimeProject $project): JsonResponse
    {
        $tail = (int) $request->query('tail', 100);
        $result = $this->agent->post('/v1/runtimes/projects', [
            'action' => 'logs',
            'name' => $project->name,
            'tail' => $tail,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('runtimes.logs_failed')], 422);
        }

        return response()->json(['logs' => $this->decodeAgentData($result)]);
    }

    public function destroy(RuntimeProject $project): JsonResponse
    {
        $this->agent->post('/v1/runtimes/projects', [
            'action' => 'stop',
            'name' => $project->name,
        ]);
        $project->delete();

        return response()->json(['message' => __('runtimes.deleted')]);
    }

    private function projectAction(RuntimeProject $project, string $action): JsonResponse
    {
        $result = $this->agent->post('/v1/runtimes/projects', [
            'action' => $action,
            'name' => $project->name,
            'runtime' => $project->runtime,
            'work_dir' => $project->work_dir,
            'entry_script' => $project->entry_script ?? '',
            'npm_script' => $project->npm_script ?? '',
        ]);

        if (! ($result['ok'] ?? false)) {
            $project->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('runtimes.action_failed'), 'project' => $project], 422);
        }

        $data = $this->decodeAgentData($result);
        $project->update([
            'status' => (string) ($data['status'] ?? $project->status),
            'pid' => isset($data['pid']) ? (int) $data['pid'] : null,
            'last_error' => null,
        ]);

        return response()->json(['project' => $project->fresh(), 'agent' => $data]);
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
