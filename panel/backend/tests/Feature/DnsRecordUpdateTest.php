<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Dns\Entities\DnsRecord;
use Modules\Dns\Entities\DnsZone;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class DnsRecordUpdateTest extends TestCase
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

    public function test_update_record_calls_agent_with_update_action(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/dns/records', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'update'
                        && ($payload['ttl'] ?? null) === 7200;
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $zone = DnsZone::query()->create(['domain' => 'example.com', 'status' => 'active']);
        $record = DnsRecord::query()->create([
            'zone_id' => $zone->id,
            'type' => 'MX',
            'name' => '@',
            'content' => 'mail.example.com',
            'ttl' => 3600,
            'priority' => 10,
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/v1/dns/records/'.$record->id, ['ttl' => 7200])
            ->assertOk()
            ->assertJsonPath('record.ttl', 7200);
    }
}
