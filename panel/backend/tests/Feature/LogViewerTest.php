<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class LogViewerTest extends TestCase
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

    public function test_log_sources(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/logs')
                ->andReturn([
                    'ok' => true,
                    'data' => ['sources' => ['nginx-error', 'auth']],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/monitoring/logs/sources')
            ->assertOk()
            ->assertJsonFragment(['nginx-error']);
    }

    public function test_log_tail(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/logs?source=nginx-error&lines=50')
                ->andReturn([
                    'ok' => true,
                    'data' => ['source' => 'nginx-error', 'content' => "error line\n"],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/monitoring/logs?source=nginx-error&lines=50')
            ->assertOk()
            ->assertJsonPath('log.content', "error line\n");
    }
}
