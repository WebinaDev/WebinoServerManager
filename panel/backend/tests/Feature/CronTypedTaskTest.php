<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class CronTypedTaskTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_typed_backup_db_task_builds_allowlisted_command(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/cron', \Mockery::on(function (array $payload): bool {
                    return str_contains($payload['command'] ?? '', '/usr/local/lib/webino/cron-backup-db')
                        && str_contains($payload['command'] ?? '', 'mydb');
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/cron/jobs', [
                'schedule' => '0 4 * * *',
                'task_type' => 'backup_db',
                'task_config' => ['database' => 'mydb'],
                'notify_on_failure' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('job.task_type', 'backup_db');
    }
}
