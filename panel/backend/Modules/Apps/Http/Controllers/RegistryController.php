<?php

namespace Modules\Apps\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Modules\Apps\Entities\DockerRegistry;
use Modules\Apps\Support\DecodesAgentPayload;

class RegistryController extends Controller
{
    use DecodesAgentPayload;

    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $rows = DockerRegistry::query()->orderBy('name')->get()->map(fn (DockerRegistry $r) => [
            'id' => $r->id,
            'name' => $r->name,
            'server' => $r->server,
            'username' => $r->username,
        ]);

        return response()->json(['registries' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:128'],
            'server' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:512'],
            'login' => ['nullable', 'boolean'],
        ]);

        $registry = DockerRegistry::query()->updateOrCreate(
            ['server' => $data['server'], 'username' => $data['username']],
            [
                'name' => $data['name'],
                'password_encrypted' => Crypt::encryptString($data['password']),
            ],
        );

        if ($data['login'] ?? true) {
            $result = $this->agent->post('/v1/docker/registry', [
                'action' => 'login',
                'server' => $registry->server,
                'username' => $registry->username,
                'password' => $data['password'],
            ]);
            if (! ($result['ok'] ?? false)) {
                return response()->json([
                    'message' => $result['error'] ?? 'login failed',
                    'registry' => [
                        'id' => $registry->id,
                        'name' => $registry->name,
                        'server' => $registry->server,
                        'username' => $registry->username,
                    ],
                ], 422);
            }
        }

        return response()->json([
            'registry' => [
                'id' => $registry->id,
                'name' => $registry->name,
                'server' => $registry->server,
                'username' => $registry->username,
            ],
        ], 201);
    }

    public function destroy(DockerRegistry $registry): JsonResponse
    {
        $this->agent->post('/v1/docker/registry', [
            'action' => 'logout',
            'server' => $registry->server,
        ]);
        $registry->delete();

        return response()->json(['ok' => true]);
    }
}
