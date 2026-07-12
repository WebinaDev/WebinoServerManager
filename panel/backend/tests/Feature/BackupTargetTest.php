<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Backup\Entities\BackupTarget;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class BackupTargetTest extends TestCase
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

    public function test_index_returns_targets(): void
    {
        BackupTarget::query()->create([
            'name' => 'S3 primary',
            'driver' => 's3',
            'config' => ['bucket' => 'webino-backups', 'password' => 'secret'],
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/backups/targets')
            ->assertOk()
            ->assertJsonCount(1, 'targets');
    }

    public function test_store_creates_target(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/backups/targets', [
                'name' => 'SFTP remote',
                'driver' => 'sftp',
                'config' => ['host' => 'backup.example.com', 'path' => '/backups', 'password' => 'secret'],
            ])
            ->assertCreated();

        $this->assertDatabaseHas('backup_targets', ['name' => 'SFTP remote']);
    }
}
