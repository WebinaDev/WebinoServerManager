<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class SecurityApiTest extends TestCase
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

    public function test_firewall_index_requires_auth(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')->with('/v1/security/firewall')->andReturn([
                'ok' => true,
                'data' => ['enabled' => true, 'rules' => []],
            ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/security/firewall')
            ->assertOk();
    }

    public function test_viewer_cannot_mutate_firewall(): void
    {
        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/v1/security/firewall', ['action' => 'enable'])
            ->assertForbidden();
    }
}
