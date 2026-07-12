<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class WafTest extends TestCase
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

    public function test_admin_can_read_and_update_waf(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/security/waf')
                ->andReturn(['ok' => true, 'data' => ['enabled' => false]]);
            $mock->shouldReceive('post')
                ->with('/v1/security/waf', ['enabled' => true])
                ->andReturn(['ok' => true, 'data' => ['enabled' => true]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/security/waf')
            ->assertOk()
            ->assertJsonPath('enabled', false);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/security/waf', ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('enabled', true);
    }
}
