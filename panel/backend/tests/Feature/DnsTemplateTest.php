<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Dns\Entities\DnsZone;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class DnsTemplateTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_apply_template_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/dns/zones', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'apply_template'
                        && ($payload['template'] ?? '') === 'web_hosting';
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $zone = DnsZone::query()->create(['domain' => 'example.com', 'status' => 'active']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/dns/zones/'.$zone->id.'/template', [
                'template' => 'web_hosting',
            ])
            ->assertOk();

        $this->assertSame('web_hosting', $zone->fresh()->template);
    }
}
