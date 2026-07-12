<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Modules\Backup\Entities\BackupSchedule;
use Modules\Backup\Jobs\RunBackupJob;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class BackupScheduleTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockAgent();
        $this->seed(RolesPermissionsSeeder::class);
        $this->user = User::factory()->create();
        $this->user->assignRole('admin');
    }

    public function test_schedule_crud(): void
    {
        $create = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/backups/schedules', [
                'name' => 'Daily files',
                'type' => 'files',
                'target' => '/var/www',
                'frequency' => 'daily',
                'retention_days' => 7,
            ])
            ->assertCreated();

        $id = $create->json('schedule.id');

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/backups/schedules')
            ->assertOk()
            ->assertJsonCount(1, 'schedules');

        $this->actingAs($this->user, 'sanctum')
            ->patchJson("/api/v1/backups/schedules/{$id}", ['enabled' => false])
            ->assertOk();

        $this->actingAs($this->user, 'sanctum')
            ->deleteJson("/api/v1/backups/schedules/{$id}")
            ->assertOk();
    }

    public function test_run_scheduled_backups_dispatches_job(): void
    {
        Queue::fake();

        BackupSchedule::query()->create([
            'name' => 'Due backup',
            'type' => 'db',
            'target' => 'webinoserver',
            'frequency' => 'daily',
            'retention_days' => 3,
            'enabled' => true,
            'next_run_at' => now()->subMinute(),
        ]);

        $this->artisan('panel:run-scheduled-backups')->assertSuccessful();

        Queue::assertPushed(RunBackupJob::class);
    }
}
