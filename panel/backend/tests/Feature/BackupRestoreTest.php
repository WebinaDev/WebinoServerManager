<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Modules\Backup\Entities\Backup;
use Modules\Backup\Jobs\RestoreBackupJob;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class BackupRestoreTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockAgent();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_restore_dispatches_job(): void
    {
        Queue::fake();

        $backup = Backup::query()->create([
            'trigger' => 'manual',
            'type' => 'files',
            'target' => 'sites/example.com',
            'filename' => 'files-test.tar.gz',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/backups/'.$backup->id.'/restore', [
                'restore_target' => 'sites/example.com',
            ])
            ->assertOk();

        Queue::assertPushed(RestoreBackupJob::class);
    }
}
