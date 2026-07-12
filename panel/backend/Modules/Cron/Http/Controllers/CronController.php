<?php

namespace Modules\Cron\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Cron\Entities\CronJob;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Services\HostingQuota;

class CronController extends Controller
{
    public function __construct(
        private readonly AgentClient $agent,
        private readonly HostingQuota $quota,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'jobs' => CronJob::query()->with('hostingAccount:id,username')->orderByDesc('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'schedule' => ['required', 'string', 'max:128'],
            'command' => ['required', 'string', 'max:2048'],
            'hosting_account_id' => ['nullable', 'exists:hosting_accounts,id'],
        ]);

        $username = null;
        if (! empty($data['hosting_account_id'])) {
            $account = HostingAccount::query()->findOrFail($data['hosting_account_id']);
            $this->quota->assert($account, 'cron');
            $username = $account->username;
        }

        $job = CronJob::query()->create([
            'schedule' => $data['schedule'],
            'command' => $data['command'],
            'hosting_account_id' => $data['hosting_account_id'] ?? null,
            'status' => 'pending',
        ]);

        $payload = [
            'schedule' => $job->schedule,
            'command' => $job->command,
            'action' => 'create',
        ];
        if ($username !== null) {
            $payload['username'] = $username;
        }

        $result = $this->agent->post('/v1/cron', $payload);

        if (! ($result['ok'] ?? false)) {
            $job->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('cron.provision_failed'), 'job' => $job], 422);
        }

        $job->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['job' => $job->fresh()->load('hostingAccount:id,username'), 'agent' => $result], 201);
    }

    public function destroy(CronJob $job): JsonResponse
    {
        $payload = [
            'schedule' => $job->schedule,
            'command' => $job->command,
            'action' => 'delete',
        ];
        if ($job->hosting_account_id) {
            $account = HostingAccount::query()->find($job->hosting_account_id);
            if ($account) {
                $payload['username'] = $account->username;
            }
        }

        $this->agent->post('/v1/cron', $payload);
        $job->delete();

        return response()->json(['message' => __('cron.deleted')]);
    }
}
