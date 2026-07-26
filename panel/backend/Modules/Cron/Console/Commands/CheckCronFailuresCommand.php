<?php

namespace Modules\Cron\Console\Commands;

use App\Services\Agent\AgentClient;
use Illuminate\Console\Command;
use Modules\Cron\Entities\CronJob;
use Modules\Monitoring\Services\NotificationDispatcher;

class CheckCronFailuresCommand extends Command
{
    protected $signature = 'panel:check-cron-failures';

    protected $description = 'Notify on cron job failures when notify_on_failure is enabled';

    public function handle(AgentClient $agent, NotificationDispatcher $dispatcher): int
    {
        $result = $agent->get('/v1/cron/failures');
        if (! ($result['ok'] ?? false)) {
            return self::SUCCESS;
        }

        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $data = json_decode($data, true) ?? [];
        }

        $failures = $data['failures'] ?? [];
        if (! is_array($failures) || $failures === []) {
            return self::SUCCESS;
        }

        $jobs = CronJob::query()
            ->where('notify_on_failure', true)
            ->get()
            ->keyBy('id');

        foreach ($failures as $failure) {
            if (! is_array($failure)) {
                continue;
            }
            $jobId = (int) ($failure['job_id'] ?? 0);
            if ($jobId <= 0 || ! $jobs->has($jobId)) {
                continue;
            }
            $job = $jobs->get($jobId);
            $subject = __('cron.failure_subject', ['id' => $job->id]);
            $body = __('cron.failure_body', [
                'schedule' => $job->schedule,
                'command' => $job->command,
                'error' => $failure['error'] ?? 'unknown',
            ]);
            $dispatcher->dispatch($subject, $body);
        }

        return self::SUCCESS;
    }
}
