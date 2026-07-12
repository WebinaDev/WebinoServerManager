<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Apps\Entities\DockerApp;
use Tests\TestCase;

class AppActionTest extends TestCase
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

    public function test_start_stop_and_logs(): void
    {
        $app = DockerApp::query()->create([
            'name' => 'webapp',
            'image' => 'nginx:alpine',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock) use ($app): void {
            $mock->shouldReceive('post')
                ->with('/v1/docker/containers', [
                    'action' => 'start',
                    'name' => $app->name,
                ])
                ->andReturn(['ok' => true, 'data' => ['output' => 'started']]);

            $mock->shouldReceive('post')
                ->with('/v1/docker/containers', [
                    'action' => 'stop',
                    'name' => $app->name,
                ])
                ->andReturn(['ok' => true, 'data' => ['output' => 'stopped']]);

            $mock->shouldReceive('post')
                ->with('/v1/docker/containers', [
                    'action' => 'logs',
                    'name' => $app->name,
                    'tail' => 100,
                ])
                ->andReturn(['ok' => true, 'data' => ['logs' => 'hello world', 'name' => $app->name]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/v1/apps/{$app->id}/start")
            ->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/v1/apps/{$app->id}/stop")
            ->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/v1/apps/{$app->id}/logs")
            ->assertOk()
            ->assertJsonPath('logs.logs', 'hello world');
    }
}
