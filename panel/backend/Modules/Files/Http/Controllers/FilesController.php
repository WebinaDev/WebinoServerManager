<?php

namespace Modules\Files\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FilesController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(Request $request): JsonResponse
    {
        $path = (string) $request->query('path', '/');

        $result = $this->agent->post('/v1/files', [
            'action' => 'list',
            'path' => $path,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('files.list_failed')], 422);
        }

        return response()->json([
            'path' => $path,
            'entries' => $this->agentPayload($result)['entries'] ?? [],
        ]);
    }

    public function read(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
        ]);

        $result = $this->agent->post('/v1/files', [
            'action' => 'read',
            'path' => $data['path'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('files.read_failed')], 422);
        }

        return response()->json([
            'path' => $data['path'],
            'content' => $this->agentPayload($result)['content'] ?? '',
        ]);
    }

    public function write(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
            'content' => ['required', 'string'],
        ]);

        $result = $this->agent->post('/v1/files', [
            'action' => 'write',
            'path' => $data['path'],
            'content' => $data['content'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('files.write_failed')], 422);
        }

        return response()->json(['message' => __('files.saved')]);
    }

    public function mkdir(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
        ]);

        $result = $this->agent->post('/v1/files', [
            'action' => 'mkdir',
            'path' => $data['path'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('files.mkdir_failed')], 422);
        }

        return response()->json(['message' => __('files.created')], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
        ]);

        $result = $this->agent->post('/v1/files', [
            'action' => 'delete',
            'path' => $data['path'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('files.delete_failed')], 422);
        }

        return response()->json(['message' => __('files.deleted')]);
    }

    public function rename(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
            'dest' => ['required', 'string', 'max:1024'],
        ]);

        $result = $this->agent->post('/v1/files', [
            'action' => 'rename',
            'path' => $data['path'],
            'dest' => $data['dest'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('files.rename_failed')], 422);
        }

        return response()->json(['message' => __('files.renamed')]);
    }

    public function chmod(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
            'mode' => ['required', 'string', 'max:8'],
        ]);

        $result = $this->agent->post('/v1/files', [
            'action' => 'chmod',
            'path' => $data['path'],
            'mode' => $data['mode'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('files.chmod_failed')], 422);
        }

        return response()->json(['message' => __('files.chmod_ok')]);
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
