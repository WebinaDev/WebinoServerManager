<?php

namespace Modules\Git\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Git\Entities\GitRepository;

class GitController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'repositories' => GitRepository::query()->orderByDesc('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:128'],
            'repo_url' => ['required', 'string', 'max:512'],
            'branch' => ['nullable', 'string', 'max:128'],
            'target_dir' => ['required', 'string', 'max:255'],
        ]);

        $repo = GitRepository::query()->create([
            'name' => $data['name'],
            'repo_url' => $data['repo_url'],
            'branch' => $data['branch'] ?? 'main',
            'target_dir' => ltrim($data['target_dir'], '/'),
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/git', [
            'action' => 'create',
            'name' => $repo->name,
            'repo_url' => $repo->repo_url,
            'branch' => $repo->branch,
            'target_dir' => $repo->target_dir,
        ]);

        if (! ($result['ok'] ?? false)) {
            $repo->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('git.clone_failed'), 'repository' => $repo], 422);
        }

        $repo->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['repository' => $repo->fresh(), 'agent' => $result], 201);
    }

    public function pull(GitRepository $repo): JsonResponse
    {
        $result = $this->agent->post('/v1/git', [
            'action' => 'pull',
            'target_dir' => $repo->target_dir,
        ]);

        if (! ($result['ok'] ?? false)) {
            $repo->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('git.pull_failed'), 'repository' => $repo], 422);
        }

        $repo->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['repository' => $repo->fresh(), 'agent' => $result]);
    }

    public function destroy(GitRepository $repo): JsonResponse
    {
        $this->agent->post('/v1/git', [
            'action' => 'delete',
            'target_dir' => $repo->target_dir,
        ]);
        $repo->delete();

        return response()->json(['message' => __('git.deleted')]);
    }
}
