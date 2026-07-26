<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformApiTest extends TestCase
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

    public function test_platform_init_calls_agent(): void
    {
        $this->mock(AgentClient::class, function ($mock): void {
            $mock->shouldReceive('webina')
                ->once()
                ->with(['platform', 'init'])
                ->andReturn(['ok' => true, 'data' => ['initialized' => true]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/platform/init')
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_sites_list_returns_sites_array(): void
    {
        $this->mock(AgentClient::class, function ($mock): void {
            $mock->shouldReceive('webina')
                ->once()
                ->with(['site', 'list'])
                ->andReturn([
                    'ok' => true,
                    'data' => [
                        'sites' => [
                            ['slug' => 'demo', 'domain' => 'demo.test', 'product' => 'Webino'],
                        ],
                    ],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/sites')
            ->assertOk()
            ->assertJsonPath('sites.0.slug', 'demo');
    }

    public function test_create_site_returns_422_when_agent_fails(): void
    {
        $this->mock(AgentClient::class, function ($mock): void {
            $mock->shouldReceive('webina')
                ->once()
                ->andReturn(['ok' => false, 'error' => 'boom']);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/sites', [
                'slug' => 'x',
                'domain' => 'x.test',
            ])
            ->assertStatus(422)
            ->assertJsonPath('ok', false);
    }
}
