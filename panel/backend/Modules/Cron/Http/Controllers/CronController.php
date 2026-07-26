<?php

namespace Modules\Cron\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Cron\Entities\CronJob;
use Modules\Cron\Services\CronTaskBuilder;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Services\HostingQuota;

class CronController extends Controller
{
    public function __construct(
        private readonly AgentClient $agent,
        private readonly HostingQuota $quota,
        private readonly CronTaskBuilder $taskBuilder,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'jobs' => CronJob::query()->with('hostingAccount:id,username')->orderByDesc('id')->get(),
        ]);
    }

    public function scriptLibrary(): JsonResponse
    {
        return response()->json(['scripts' => $this->taskBuilder->library()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'schedule' => ['required', 'string', 'max:128'],
            'command' => ['nullable', 'string', 'max:2048'],
            'task_type' => ['nullable', 'string', 'max:32'],
            'task_config' => ['nullable', 'array'],
            'notify_on_failure' => ['boolean'],
            'hosting_account_id' => ['nullable', 'exists:hosting_accounts,id'],
        ]);

        $taskType = $data['task_type'] ?? 'shell';
        $taskConfig = $data['task_config'] ?? [];

        try {
            $command = $this->taskBuilder->build($taskType, $taskConfig, $data['command'] ?? null);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($command === '') {
            return response()->json(['message' => __('cron.command_required')], 422);
        }

        $username = null;
        if (! empty($data['hosting_account_id'])) {
            $account = HostingAccount::query()->findOrFail($data['hosting_account_id']);
            $this->quota->assert($account, 'cron');
            $username = $account->username;
        }

        $job = CronJob::query()->create([
            'schedule' => $data['schedule'],
            'command' => $command,
            'task_type' => $taskType,
            'task_config' => $taskConfig !== [] ? $taskConfig : null,
            'notify_on_failure' => $request->boolean('notify_on_failure'),
            'hosting_account_id' => $data['hosting_account_id'] ?? null,
            'status' => 'pending',
        ]);

        $payload = [
            'schedule' => $job->schedule,
            'command' => $job->command,
            'action' => 'create',
            'job_id' => $job->id,
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
            'job_id' => $job->id,
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
