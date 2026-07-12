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

class DnsZoneImportTest extends TestCase
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

    public function test_import_zone_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/dns/zones', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'import'
                        && str_contains($payload['content'] ?? '', '$ORIGIN');
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $zone = DnsZone::query()->create(['domain' => 'example.com', 'status' => 'active']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/dns/zones/'.$zone->id.'/import', [
                'content' => '$ORIGIN example.com.',
            ])
            ->assertOk();
    }
}
