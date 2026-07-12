<?php

namespace Modules\Ftp\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Ftp\Entities\FtpAccount;

class FtpController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'accounts' => FtpAccount::query()->orderBy('username')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:32', 'regex:/^[a-zA-Z0-9_]+$/', 'unique:ftp_accounts,username'],
            'password' => ['required', 'string', 'min:8'],
            'home_dir' => ['required', 'string', 'max:512'],
            'domain' => ['nullable', 'string', 'max:253'],
        ]);

        $account = FtpAccount::query()->create([
            'username' => $data['username'],
            'home_dir' => $data['home_dir'],
            'domain' => $data['domain'] ?? null,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/ftp/accounts', [
            'username' => $account->username,
            'password' => $data['password'],
            'home_dir' => $account->home_dir,
            'action' => 'create',
        ]);

        if (! ($result['ok'] ?? false)) {
            $account->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('ftp.provision_failed'), 'account' => $account], 422);
        }

        $account->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['account' => $account->fresh(), 'agent' => $result], 201);
    }

    public function destroy(FtpAccount $account): JsonResponse
    {
        $this->agent->post('/v1/ftp/accounts', [
            'username' => $account->username,
            'action' => 'delete',
        ]);
        $account->delete();

        return response()->json(['message' => __('ftp.deleted')]);
    }
}
