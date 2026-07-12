<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Modules\Backup\Entities\Backup;
use Modules\Backup\Jobs\VerifyBackupJob;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class BackupVerifyTest extends TestCase
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

    public function test_verify_dispatches_job(): void
    {
        Queue::fake();

        $backup = Backup::query()->create([
            'trigger' => 'manual',
            'type' => 'db',
            'target' => 'mydb',
            'filename' => 'db-mydb.sql.gz',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/backups/'.$backup->id.'/verify')
            ->assertOk();

        Queue::assertPushed(VerifyBackupJob::class);
    }
}
