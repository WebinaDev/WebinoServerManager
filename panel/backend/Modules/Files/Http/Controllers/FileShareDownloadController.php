<?php

namespace Modules\Files\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\Response;
use Modules\Files\Entities\FileShare;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileShareDownloadController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function __invoke(string $token): Response|StreamedResponse
    {
        $share = FileShare::query()->where('token', $token)->first();
        if ($share === null || $share->expires_at->isPast()) {
            abort(404);
        }

        $result = $this->agent->post('/v1/files', [
            'action' => 'read',
            'path' => $share->path,
        ]);

        if (! ($result['ok'] ?? false)) {
            abort(404);
        }

        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $data = json_decode($data, true) ?? [];
        }
        $content = is_array($data) ? (string) ($data['content'] ?? '') : '';
        $share->increment('download_count');

        $name = basename($share->path);

        return response($content, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
        ]);
    }
}
