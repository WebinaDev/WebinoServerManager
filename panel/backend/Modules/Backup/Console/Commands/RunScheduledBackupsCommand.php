<?php

namespace Modules\Backup\Console\Commands;

use Illuminate\Console\Command;
use Modules\Backup\Entities\BackupSchedule;
use Modules\Backup\Jobs\RunBackupJob;

class RunScheduledBackupsCommand extends Command
{
    protected $signature = 'panel:run-scheduled-backups';

    protected $description = 'Dispatch due backup schedules to the queue';

    public function handle(): int
    {
        $due = BackupSchedule::query()->where('enabled', true)->get()->filter(fn (BackupSchedule $s) => $s->isDue());

        foreach ($due as $schedule) {
            RunBackupJob::dispatch($schedule->id);
            $schedule->update([
                'last_run_at' => now(),
                'next_run_at' => $schedule->computeNextRunAt(),
            ]);
            $this->info("Dispatched backup schedule #{$schedule->id} ({$schedule->name})");
        }

        return self::SUCCESS;
    }
}
