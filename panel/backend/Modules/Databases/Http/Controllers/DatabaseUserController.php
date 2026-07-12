<?php

namespace Modules\Databases\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Modules\Databases\Entities\DatabaseUser;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Services\HostingQuota;

class DatabaseUserController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'users' => DatabaseUser::query()->with('database')->orderBy('username')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9_]+$/'],
            'host' => ['nullable', 'string', 'max:64'],
            'password' => ['required', 'string', 'min:8'],
            'database_id' => ['nullable', 'exists:hosting_databases,id'],
            'hosting_account_id' => ['nullable', 'exists:hosting_accounts,id'],
            'grant' => ['sometimes', 'boolean'],
        ]);

        $host = $data['host'] ?? 'localhost';
        $db = isset($data['database_id']) ? HostingDatabase::query()->find($data['database_id']) : null;

        $result = $this->agent->post('/v1/databases/users', [
            'action' => 'create_user',
            'user' => $data['username'],
            'host' => $host,
            'password' => $data['password'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.user_create_failed')], 422);
        }

        if ($request->boolean('grant', true) && $db) {
            $this->agent->post('/v1/databases/users', [
                'action' => 'grant',
                'user' => $data['username'],
                'host' => $host,
                'database' => $db->name,
            ]);
        }

        $record = DatabaseUser::query()->create([
            'username' => $data['username'],
            'host' => $host,
            'engine' => $db?->engine ?? 'mysql',
            'database_id' => $db?->id,
            'hosting_account_id' => $data['hosting_account_id'] ?? null,
        ]);

        return response()->json(['user' => $record->load('database')], 201);
    }

    public function update(Request $request, DatabaseUser $user): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ]);

        $result = $this->agent->post('/v1/databases/users', [
            'action' => 'passwd_user',
            'user' => $user->username,
            'host' => $user->host,
            'password' => $data['password'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.user_passwd_failed')], 422);
        }

        return response()->json(['user' => $user->fresh(), 'message' => __('databases.user_passwd_ok')]);
    }

    public function destroy(DatabaseUser $user): JsonResponse
    {
        $result = $this->agent->post('/v1/databases/users', [
            'action' => 'drop_user',
            'user' => $user->username,
            'host' => $user->host,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.user_delete_failed')], 422);
        }

        $user->delete();

        return response()->json(['message' => __('databases.user_deleted')]);
    }
}
