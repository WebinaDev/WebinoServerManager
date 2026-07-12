<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class ServiceControlTest extends TestCase
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

    public function test_services_index(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/services')
                ->andReturn([
                    'ok' => true,
                    'data' => [
                        'services' => [
                            ['name' => 'nginx', 'active' => 'active', 'enabled' => 'enabled'],
                        ],
                    ],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/monitoring/services')
            ->assertOk()
            ->assertJsonPath('services.0.name', 'nginx');
    }

    public function test_service_restart_action(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/services', ['service' => 'nginx', 'action' => 'restart'])
                ->andReturn(['ok' => true, 'data' => ['output' => 'ok']]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/monitoring/services/action', [
                'service' => 'nginx',
                'action' => 'restart',
            ])
            ->assertOk();
    }
}
