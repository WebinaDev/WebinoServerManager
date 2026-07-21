<?php

namespace Modules\Hosting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Services\HostingQuota;

class HostingAccountController extends Controller
{
    public function __construct(
        private readonly AgentClient $agent,
        private readonly HostingQuota $quota,
    ) {}

    public function index(): JsonResponse
    {
        $accounts = HostingAccount::query()
            ->with(['plan', 'owner:id,name,email'])
            ->orderBy('username')
            ->get();

        return response()->json(['accounts' => $accounts]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plan_id' => ['required', 'exists:hosting_plans,id'],
            'username' => ['required', 'string', 'max:32', 'regex:/^[a-z][a-z0-9_]*$/', 'unique:hosting_accounts,username'],
            'user_id' => ['nullable', 'exists:users,id'],
            'primary_domain' => ['nullable', 'string', 'max:253'],
        ]);

        $username = strtolower($data['username']);

        $provision = $this->agent->post('/v1/hosting/provision', [
            'username' => $username,
        ]);

        if (! ($provision['ok'] ?? false)) {
            return response()->json([
                'message' => $provision['error'] ?? __('hosting.provision_failed'),
            ], 422);
        }

        $account = HostingAccount::query()->create([
            'plan_id' => $data['plan_id'],
            'username' => $username,
            'user_id' => $data['user_id'] ?? null,
            'primary_domain' => $data['primary_domain'] ?? null,
            'status' => 'active',
        ]);

        return response()->json([
            'account' => $account->load(['plan', 'owner']),
            'agent' => $provision,
            'message' => __('hosting.account_saved'),
        ], 201);
    }

    public function update(Request $request, HostingAccount $account): JsonResponse
    {
        $data = $request->validate([
            'plan_id' => ['sometimes', 'exists:hosting_plans,id'],
            'user_id' => ['nullable', 'exists:users,id'],
            'primary_domain' => ['nullable', 'string', 'max:253'],
        ]);

        $account->update($data);

        return response()->json([
            'account' => $account->fresh()->load(['plan', 'owner']),
            'message' => __('hosting.account_saved'),
        ]);
    }

    public function destroy(HostingAccount $account): JsonResponse
    {
        $result = $this->agent->post('/v1/hosting/deprovision', [
            'username' => $account->username,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json([
                'message' => $result['error'] ?? __('hosting.deprovision_failed'),
            ], 422);
        }

        $account->delete();

        return response()->json(['message' => __('hosting.account_deleted')]);
    }

    public function suspend(Request $request, HostingAccount $account): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $result = $this->agent->post('/v1/hosting/suspend', [
            'username' => $account->username,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('hosting.suspend_failed')], 422);
        }

        $account->update([
            'status' => 'suspended',
            'suspended_at' => now(),
            'suspend_reason' => $data['reason'] ?? null,
        ]);

        return response()->json([
            'account' => $account->fresh()->load('plan'),
            'message' => __('hosting.suspended'),
        ]);
    }

    public function unsuspend(HostingAccount $account): JsonResponse
    {
        $result = $this->agent->post('/v1/hosting/unsuspend', [
            'username' => $account->username,
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('hosting.unsuspend_failed')], 422);
        }

        $account->update([
            'status' => 'active',
            'suspended_at' => null,
            'suspend_reason' => null,
        ]);

        return response()->json([
            'account' => $account->fresh()->load('plan'),
            'message' => __('hosting.unsuspended'),
        ]);
    }

    public function usage(HostingAccount $account): JsonResponse
    {
        return response()->json([
            'account' => $account->load('plan'),
            'usage' => $this->quota->usageSummary($account),
        ]);
    }
}
