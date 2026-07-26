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
}
