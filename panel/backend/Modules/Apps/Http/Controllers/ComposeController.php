<?php

namespace Modules\Apps\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Apps\Entities\DockerComposeProject;
use Modules\Apps\Support\DecodesAgentPayload;

class ComposeController extends Controller
{
    use DecodesAgentPayload;

    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'projects' => DockerComposeProject::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/', 'unique:docker_compose_projects,name'],
            'compose_yaml' => ['required', 'string', 'max:65535'],
            'env_file' => ['nullable', 'string', 'max:16384'],
        ]);

        $projectDir = '/var/lib/webino/compose/'.$data['name'];
        $project = DockerComposeProject::query()->create([
            'name' => $data['name'],
            'project_dir' => $projectDir,
            'compose_yaml' => $data['compose_yaml'],
            'env_file' => $data['env_file'] ?? null,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/docker/compose', [
            'action' => 'up',
            'project' => $project->name,
            'compose_yaml' => $project->compose_yaml,
            'env_file' => $project->env_file ?? '',
        ]);

        if (! ($result['ok'] ?? false)) {
            $project->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? 'compose up failed', 'project' => $project], 422);
        }

        $agentData = $this->agentPayload($result);
        if (! empty($agentData['dir'])) {
            $projectDir = $agentData['dir'];
        }
        $project->update([
            'project_dir' => $projectDir,
            'status' => 'active',
            'last_error' => null,
        ]);

        return response()->json(['project' => $project->fresh(), 'agent' => $agentData], 201);
    }

    public function down(DockerComposeProject $project): JsonResponse
    {
        $result = $this->agent->post('/v1/docker/compose', [
            'action' => 'down',
            'project' => $project->name,
        ]);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'compose down failed'], 422);
        }
        $project->update(['status' => 'stopped']);

        return response()->json(['project' => $project->fresh(), 'agent' => $this->agentPayload($result)]);
    }

    public function up(DockerComposeProject $project): JsonResponse
    {
        $result = $this->agent->post('/v1/docker/compose', [
            'action' => 'up',
            'project' => $project->name,
            'compose_yaml' => $project->compose_yaml,
            'env_file' => $project->env_file ?? '',
        ]);
        if (! ($result['ok'] ?? false)) {
            $project->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? 'compose up failed', 'project' => $project], 422);
        }
        $project->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['project' => $project->fresh(), 'agent' => $this->agentPayload($result)]);
    }

    public function logs(DockerComposeProject $project, Request $request): JsonResponse
    {
        $tail = (int) $request->query('tail', 100);
        $result = $this->agent->post('/v1/docker/compose', [
            'action' => 'logs',
            'project' => $project->name,
            'tail' => $tail,
        ]);
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? 'logs failed'], 422);
        }

        return response()->json($this->agentPayload($result));
    }

    public function destroy(DockerComposeProject $project): JsonResponse
    {
        $this->agent->post('/v1/docker/compose', [
            'action' => 'down',
            'project' => $project->name,
        ]);
        $project->delete();

        return response()->json(['ok' => true]);
    }
}
