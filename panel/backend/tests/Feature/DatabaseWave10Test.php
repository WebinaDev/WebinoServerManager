<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Databases\Entities\HostingDatabase;
use Tests\TestCase;

class DatabaseWave10Test extends TestCase
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

    public function test_database_recycle_soft_deletes(): void
    {
        $database = HostingDatabase::query()->create([
            'name' => 'app_db',
            'engine' => 'mysql',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/v1/databases/{$database->id}")
            ->assertOk();

        $this->assertSoftDeleted('hosting_databases', ['id' => $database->id]);
    }

    public function test_database_repair_calls_agent(): void
    {
        $database = HostingDatabase::query()->create([
            'name' => 'app_db',
            'engine' => 'mysql',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/databases', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'repair';
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/v1/databases/{$database->id}/repair")
            ->assertOk();
    }
}
