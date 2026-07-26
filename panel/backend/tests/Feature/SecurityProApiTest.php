<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class SecurityProApiTest extends TestCase
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

    public function test_risks_index_persists_checks(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')->with('/v1/security/risks')->andReturn([
                'ok' => true,
                'data' => [
                    'checks' => [
                        [
                            'id' => 'firewall_active',
                            'status' => 'fail',
                            'title' => 'UFW firewall active',
                            'fixable' => true,
                        ],
                    ],
                ],
            ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/security/risks')
            ->assertOk()
            ->assertJsonPath('checks.0.check_id', 'firewall_active');

        $this->assertDatabaseHas('security_risk_checks', [
            'check_id' => 'firewall_active',
            'status' => 'fail',
        ]);
    }

    public function test_disk_requires_system_manage(): void
    {
        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/system/disk')
            ->assertForbidden();
    }

    public function test_tamper_baseline_proxies_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/security/tamper', \Mockery::type('array'))
                ->andReturn(['ok' => true, 'data' => ['files' => 0]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/security/tamper/baseline')
            ->assertOk();
    }
}
