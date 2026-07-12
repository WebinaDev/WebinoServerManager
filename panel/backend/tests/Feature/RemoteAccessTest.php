<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class RemoteAccessTest extends TestCase
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

    public function test_remote_access_requires_auth(): void
    {
        $this->getJson('/api/v1/databases/remote-access')->assertUnauthorized();
    }

    public function test_viewer_can_read_remote_access(): void
    {
        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->once()
                ->with('/v1/databases/remote-access')
                ->andReturn([
                    'ok' => true,
                    'data' => [
                        'enabled' => false,
                        'allowed_ips' => [],
                        'host' => '10.0.0.1',
                        'mysql_port' => 3306,
                        'pgsql_port' => 5432,
                    ],
                ]);
        });

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/databases/remote-access')
            ->assertOk()
            ->assertJsonPath('remote_access.mysql_port', 3306);
    }

    public function test_viewer_cannot_update_remote_access(): void
    {
        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/v1/databases/remote-access', [
                'enabled' => true,
                'allowed_ips' => ['203.0.113.5'],
            ])
            ->assertForbidden();
    }

    public function test_admin_can_disable_remote_access(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/databases/remote-access', [
                    'enabled' => false,
                    'allowed_ips' => [],
                ])
                ->andReturn([
                    'ok' => true,
                    'data' => [
                        'enabled' => false,
                        'allowed_ips' => [],
                        'host' => '10.0.0.1',
                        'mysql_port' => 3306,
                        'pgsql_port' => 5432,
                    ],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/databases/remote-access', [
                'enabled' => false,
                'allowed_ips' => [],
            ])
            ->assertOk()
            ->assertJsonPath('remote_access.enabled', false);
    }

    public function test_agent_error_surfaces_message(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->once()
                ->with('/v1/databases/remote-access')
                ->andReturn(['ok' => false, 'error' => 'ufw unavailable']);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/databases/remote-access')
            ->assertStatus(422)
            ->assertJsonPath('message', 'ufw unavailable');
    }
}
