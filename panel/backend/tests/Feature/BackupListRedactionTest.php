<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Backup\Entities\Backup;
use Modules\Backup\Entities\BackupTarget;
use Tests\TestCase;

class BackupListRedactionTest extends TestCase
{
    use RefreshDatabase;

    public function test_backup_list_redacts_target_secrets(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $target = BackupTarget::query()->create([
            'name' => 'offsite',
            'driver' => 'sftp',
            'config' => ['host' => 'backup.example.com', 'password' => 'super-secret'],
            'enabled' => true,
        ]);

        Backup::query()->create([
            'trigger' => 'manual',
            'type' => 'full',
            'target' => '/var/backups/test',
            'target_id' => $target->id,
            'filename' => 'test.tar.gz',
            'status' => 'active',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/backups')
            ->assertOk();

        $json = $response->json();
        $this->assertStringNotContainsString('super-secret', json_encode($json));
        $this->assertSame('***', $json['backups'][0]['target']['config']['password'] ?? null);
    }
}
