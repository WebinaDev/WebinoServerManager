<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Databases\Entities\HostingDatabase;
use Tests\TestCase;

class DatabaseDestroyTest extends TestCase
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

    public function test_destroy_soft_recycles_without_dropping_on_host(): void
    {
        $db = HostingDatabase::query()->create([
            'name' => 'app_db',
            'db_user' => 'u_test',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/v1/databases/'.$db->id)
            ->assertOk();

        $this->assertSoftDeleted('hosting_databases', ['id' => $db->id, 'name' => 'app_db']);
    }

    public function test_purge_recycle_drops_mysql_user_and_database(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/databases/users', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'drop_user'
                        && ($payload['user'] ?? '') === 'u_test';
                }))
                ->andReturn(['ok' => true]);
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/databases', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'delete_db'
                        && ($payload['name'] ?? '') === 'app_db';
                }))
                ->andReturn(['ok' => true]);
        });

        $db = HostingDatabase::query()->create([
            'name' => 'app_db',
            'db_user' => 'u_test',
            'status' => 'active',
        ]);
        $db->delete();

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/v1/databases/recycle/'.$db->id)
            ->assertOk();

        $this->assertDatabaseMissing('hosting_databases', ['id' => $db->id]);
    }
}
