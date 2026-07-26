<?php

namespace Modules\Databases\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Services\HostingQuota;

class DatabaseController extends Controller
{
    public function __construct(
        private readonly AgentClient $agent,
        private readonly HostingQuota $quota,
    ) {}

    public function index(): JsonResponse
    {
        $records = HostingDatabase::query()->orderBy('name')->get()->keyBy('name');

        $agentMysql = $this->agent->get('/v1/databases?engine=mysql');
        $agentPgsql = $this->agent->get('/v1/databases?engine=pgsql');
        $agentRedis = $this->agent->get('/v1/databases?engine=redis');

        foreach ([$agentMysql, $agentPgsql, $agentRedis] as $agentResult) {
            if (! ($agentResult['ok'] ?? false)) {
                continue;
            }
            $data = $this->agentPayload($agentResult);
            foreach ($data['databases'] ?? [] as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $name = $row['name'] ?? '';
                if ($name === '') {
                    continue;
                }
                if ($records->has($name)) {
                    $records[$name]->size_mb = (int) ($row['size_mb'] ?? $records[$name]->size_mb);
                }
            }
        }

        return response()->json([
            'databases' => $records->values(),
        ]);
    }

    public function recycleIndex(): JsonResponse
    {
        return response()->json([
            'databases' => HostingDatabase::onlyTrashed()->orderByDesc('deleted_at')->get(),
        ]);
    }

    public function rootPasswordStatus(): JsonResponse
    {
        return response()->json([
            'configured' => PanelSetting::getEncrypted('mysql_root_password') !== null,
        ]);
    }

    public function updateRootPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:12', 'max:128'],
        ]);

        $result = $this->agent->post('/v1/databases', [
            'action' => 'set_root_password',
            'password' => $data['password'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.root_password_failed')], 422);
        }

        PanelSetting::setEncrypted('mysql_root_password', $data['password']);

        return response()->json(['message' => __('databases.root_password_updated')]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64', 'regex:/^[a-zA-Z0-9_]+$/'],
            'engine' => ['nullable', 'in:mysql,pgsql,redis'],
            'create_user' => ['boolean'],
            'hosting_account_id' => ['nullable', 'exists:hosting_accounts,id'],
        ]);

        $engine = $data['engine'] ?? 'mysql';

        if (! empty($data['hosting_account_id'])) {
            $account = HostingAccount::query()->findOrFail($data['hosting_account_id']);
            $this->quota->assert($account, 'databases');
        }

        $user = null;
        $password = null;
        if ($request->boolean('create_user', true) && $engine === 'mysql') {
            $user = 'u_'.Str::lower(Str::random(8));
            $password = Str::password(16);
        }

        $record = HostingDatabase::query()->create([
            'name' => $data['name'],
            'engine' => $engine,
            'db_user' => $user,
            'hosting_account_id' => $data['hosting_account_id'] ?? null,
            'status' => 'pending',
        ]);

        $payload = [
            'action' => 'create',
            'name' => $record->name,
            'engine' => $engine,
            'user' => $user ?? '',
            'password' => $password ?? '',
        ];

        $result = $this->agent->post('/v1/databases', $payload);

        if (! ($result['ok'] ?? false)) {
            $record->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('databases.create_failed'), 'database' => $record], 422);
        }

        $agentData = $this->agentPayload($result);
        $size = $engine === 'redis' ? 0 : $this->fetchSize($record->name, $engine);

        $record->update([
            'status' => 'active',
            'last_error' => null,
            'size_mb' => $size,
            'db_password_encrypted' => $password ? encrypt($password) : null,
        ]);

        return response()->json([
            'database' => $record->fresh(),
            'credentials' => $password ? ['user' => $user, 'password' => $password] : null,
            'agent' => $agentData,
        ], 201);
    }

    public function destroy(HostingDatabase $database): JsonResponse
    {
        $database->delete();

        return response()->json(['message' => __('databases.recycled')]);
    }

    public function restoreRecycle(int $databaseId): JsonResponse
    {
        $database = HostingDatabase::onlyTrashed()->findOrFail($databaseId);
        $database->restore();

        return response()->json(['database' => $database->fresh(), 'message' => __('databases.restored')]);
    }

    public function purgeRecycle(int $databaseId): JsonResponse
    {
        $database = HostingDatabase::onlyTrashed()->findOrFail($databaseId);

        if ($database->db_user) {
            $this->agent->post('/v1/databases/users', [
                'action' => 'drop_user',
                'user' => $database->db_user,
                'host' => 'localhost',
            ]);
        }

        $result = $this->agent->post('/v1/databases', [
            'action' => 'delete_db',
            'name' => $database->name,
            'engine' => $database->engine ?? 'mysql',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.delete_failed')], 422);
        }

        $database->forceDelete();

        return response()->json(['message' => __('databases.purged')]);
    }

    public function repair(HostingDatabase $database): JsonResponse
    {
        $result = $this->agent->post('/v1/databases', [
            'action' => 'repair',
            'name' => $database->name,
            'engine' => $database->engine ?? 'mysql',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.repair_failed')], 422);
        }

        return response()->json(['message' => __('databases.repair_started'), 'agent' => $this->agentPayload($result)]);
    }

    public function optimize(HostingDatabase $database): JsonResponse
    {
        $result = $this->agent->post('/v1/databases', [
            'action' => 'optimize',
            'name' => $database->name,
            'engine' => $database->engine ?? 'mysql',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.optimize_failed')], 422);
        }

        return response()->json(['message' => __('databases.optimize_started'), 'agent' => $this->agentPayload($result)]);
    }

    public function changeEngine(Request $request, HostingDatabase $database): JsonResponse
    {
        $data = $request->validate([
            'engine' => ['required', 'in:InnoDB,MyISAM'],
        ]);

        $result = $this->agent->post('/v1/databases', [
            'action' => 'set_engine',
            'name' => $database->name,
            'storage_engine' => $data['engine'],
            'engine' => $database->engine ?? 'mysql',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.engine_failed')], 422);
        }

        return response()->json(['message' => __('databases.engine_updated'), 'agent' => $this->agentPayload($result)]);
    }

    public function export(HostingDatabase $database): JsonResponse
    {
        $result = $this->agent->post('/v1/databases', [
            'action' => 'export',
            'name' => $database->name,
            'engine' => $database->engine ?? 'mysql',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.export_failed')], 422);
        }

        $data = $this->agentPayload($result);

        return response()->json(['export' => $data, 'message' => __('databases.export_started')]);
    }

    public function import(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64'],
            'file' => ['required', 'string', 'max:255', 'regex:/^[a-zA-Z0-9._-]+$/'],
            'engine' => ['nullable', 'in:mysql,pgsql'],
        ]);

        $data['file'] = basename($data['file']);

        $result = $this->agent->post('/v1/databases', [
            'action' => 'import',
            'name' => $data['name'],
            'file' => $data['file'],
            'engine' => $data['engine'] ?? 'mysql',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.import_failed')], 422);
        }

        return response()->json(['message' => __('databases.import_started'), 'agent' => $this->agentPayload($result)]);
    }

    public function size(HostingDatabase $database): JsonResponse
    {
        $size = $this->fetchSize($database->name, $database->engine ?? 'mysql');
        $database->update(['size_mb' => $size]);

        return response()->json(['database' => $database->fresh(), 'size_mb' => $size]);
    }

    public function remoteAccess(): JsonResponse
    {
        $result = $this->agent->get('/v1/databases/remote-access');
        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.remote_access_failed')], 422);
        }

        return response()->json(['remote_access' => $this->agentPayload($result)]);
    }

    public function updateRemoteAccess(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'allowed_ips' => ['array'],
            'allowed_ips.*' => ['string', 'max:64'],
        ]);

        $result = $this->agent->post('/v1/databases/remote-access', [
            'enabled' => $data['enabled'],
            'allowed_ips' => $data['allowed_ips'] ?? [],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('databases.remote_access_failed')], 422);
        }

        return response()->json([
            'remote_access' => $this->agentPayload($result),
            'message' => __('databases.remote_access_updated'),
        ]);
    }

    private function fetchSize(string $name, string $engine): int
    {
        $result = $this->agent->post('/v1/databases', [
            'action' => 'size',
            'name' => $name,
            'engine' => $engine,
        ]);
        if (! ($result['ok'] ?? false)) {
            return 0;
        }
        $data = $this->agentPayload($result);

        return (int) ($data['size_mb'] ?? 0);
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
