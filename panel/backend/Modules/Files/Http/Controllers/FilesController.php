<?php

namespace Modules\Files\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use App\Services\Security\OutboundUrlGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

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

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['nullable', 'string', 'max:1024'],
            'query' => ['required', 'string', 'max:128'],
            'max_depth' => ['nullable', 'integer', 'min:1', 'max:8'],
            'max_hits' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $result = $this->agent->post('/v1/files', [
            'action' => 'search',
            'path' => $data['path'] ?? '/',
            'query' => $data['query'],
            'max_depth' => $data['max_depth'] ?? 4,
            'max_hits' => $data['max_hits'] ?? 100,
        ]);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function remoteDownload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
            'url' => ['required', 'url', 'max:2048'],
        ]);

        try {
            OutboundUrlGuard::assertSafeHttpUrl($data['url']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $result = $this->agent->post('/v1/files', [
            'action' => 'remote_download',
            'path' => $data['path'],
            'url' => $data['url'],
        ]);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function recycleList(): JsonResponse
    {
        $result = $this->agent->post('/v1/files', ['action' => 'recycle_list', 'path' => '/']);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function recycleRestore(Request $request): JsonResponse
    {
        $data = $request->validate(['id' => ['required', 'string', 'max:64']]);
        $result = $this->agent->post('/v1/files', [
            'action' => 'recycle_restore',
            'path' => $data['id'],
        ]);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function recyclePurge(Request $request): JsonResponse
    {
        $data = $request->validate(['id' => ['required', 'string', 'max:64']]);
        $result = $this->agent->post('/v1/files', [
            'action' => 'recycle_purge',
            'path' => $data['id'],
        ]);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function versions(Request $request): JsonResponse
    {
        $data = $request->validate(['path' => ['required', 'string', 'max:1024']]);
        $result = $this->agent->post('/v1/files', [
            'action' => 'versions',
            'path' => $data['path'],
        ]);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function restoreVersion(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
            'version' => ['required', 'string', 'max:64'],
        ]);
        $result = $this->agent->post('/v1/files', [
            'action' => 'restore_version',
            'path' => $data['path'],
            'dest' => $data['version'],
        ]);

        return response()->json($this->agentPayload($result), ($result['ok'] ?? false) ? 200 : 422);
    }

    public function createShare(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1024'],
            'expires_hours' => ['nullable', 'integer', 'min:1', 'max:168'],
        ]);

        $share = \Modules\Files\Entities\FileShare::query()->create([
            'token' => bin2hex(random_bytes(24)),
            'path' => $data['path'],
            'expires_at' => now()->addHours($data['expires_hours'] ?? 24),
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'share' => $share,
            'url' => url('/api/v1/files/share/'.$share->token),
        ], 201);
    }

    public function listShares(): JsonResponse
    {
        return response()->json([
            'shares' => \Modules\Files\Entities\FileShare::query()->orderByDesc('id')->limit(100)->get(),
        ]);
    }

    public function destroyShare(\Modules\Files\Entities\FileShare $share): JsonResponse
    {
        $share->delete();

        return response()->json(['ok' => true]);
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
