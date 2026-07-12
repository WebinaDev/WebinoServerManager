<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class AppTest extends TestCase
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

    public function test_index_lists_apps(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/docker/containers')
                ->andReturn([
                    'ok' => true,
                    'data' => ['containers' => []],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/apps')
            ->assertOk()
            ->assertJsonStructure(['apps']);
    }

    public function test_store_creates_docker_app(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/docker/containers', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'run'
                        && ($payload['name'] ?? '') === 'myapp'
                        && ($payload['image'] ?? '') === 'nginx:alpine';
                }))
                ->andReturn([
                    'ok' => true,
                    'data' => ['container_id' => 'abc123'],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/apps', [
                'name' => 'myapp',
                'image' => 'nginx:alpine',
                'ports' => ['8080:80'],
            ])
            ->assertCreated()
            ->assertJsonPath('app.name', 'myapp')
            ->assertJsonPath('app.status', 'active');

        $this->assertDatabaseHas('docker_apps', ['name' => 'myapp', 'image' => 'nginx:alpine']);
    }

    public function test_viewer_cannot_create_app(): void
    {
        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/v1/apps', [
                'name' => 'denied',
                'image' => 'nginx:alpine',
            ])
            ->assertForbidden();
    }
}
