<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class PanelSettingsWave12Test extends TestCase
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

    public function test_panel_settings_index_is_read_open(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->once()
                ->with('/v1/panel/settings')
                ->andReturn(['ok' => true, 'data' => json_encode([
                    'bind_domain' => '',
                    'http_port' => 2090,
                    'https_port' => 2090,
                    'ssl_enabled' => false,
                ])]);
        });

        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/panel/settings')
            ->assertOk()
            ->assertJsonStructure(['settings', 'links']);
    }

    public function test_panel_restart_requires_confirm(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/panel/restart', ['confirm' => 'RESTART'])
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/panel/restart', ['confirm' => 'RESTART'])
            ->assertOk();
    }
}
