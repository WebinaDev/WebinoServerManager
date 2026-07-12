<?php

namespace Tests\Feature;

use App\Models\PanelSetting;
use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class DashboardSummaryTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        PanelSetting::set('setup_completed', true);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_sites_count_from_agent_registry(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/domains')
                ->andReturn([
                    'ok' => true,
                    'data' => [
                        'domains' => [
                            ['domain' => 'a.example.com'],
                            ['domain' => 'b.example.com'],
                        ],
                    ],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.sites', 2);
    }

    public function test_sites_count_fallback_on_agent_failure(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/domains')
                ->andThrow(new \RuntimeException('agent down'));
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.sites', 0);
    }
}
