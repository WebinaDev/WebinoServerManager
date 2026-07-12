<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class PlatformSiteTest extends TestCase
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

    public function test_admin_can_delete_site_via_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('webina')
                ->with(['site', 'delete', '--slug', 'demo', '--yes'])
                ->once()
                ->andReturn(['ok' => true, 'data' => ['deleted' => 'demo']]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/v1/sites/demo')
            ->assertOk()
            ->assertJsonPath('ok', true);
    }
}
