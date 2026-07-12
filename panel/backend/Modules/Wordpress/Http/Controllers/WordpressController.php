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
}
