<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Dns\Entities\DnsProvider;
use Tests\TestCase;

class AliDnsProviderTest extends TestCase
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

    public function test_alidns_sync_forwards_records_to_agent(): void
    {
        $provider = DnsProvider::query()->create([
            'provider' => 'alidns',
            'enabled' => true,
            'default_zone_id' => 'example.com',
        ]);
        $provider->api_token = 'AKIDtest:secretkeyvalue';
        $provider->save();

        $this->mock(AgentClient::class, function ($mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/dns/providers/alidns', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'sync_records'
                        && ($payload['zone_id'] ?? '') === 'example.com'
                        && ($payload['api_token'] ?? '') === 'AKIDtest:secretkeyvalue'
                        && is_array($payload['records'] ?? null)
                        && count($payload['records']) === 1;
                }))
                ->andReturn(['ok' => true, 'data' => ['synced' => 1]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/dns/providers/alidns/sync', [
                'domain' => 'example.com',
                'records' => [
                    ['type' => 'A', 'name' => '@', 'content' => '1.2.3.4'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('agent.synced', 1);
    }

    public function test_alidns_dns01_forwards_txt_to_agent(): void
    {
        $provider = DnsProvider::query()->create([
            'provider' => 'alidns',
            'enabled' => true,
            'default_zone_id' => 'example.com',
        ]);
        $provider->api_token = 'AKIDtest:secretkeyvalue';
        $provider->save();

        $this->mock(AgentClient::class, function ($mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/dns/providers/alidns', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'dns01'
                        && ($payload['record_name'] ?? '') === '_acme-challenge.example.com'
                        && ($payload['record_value'] ?? '') === 'token-value';
                }))
                ->andReturn(['ok' => true, 'data' => ['action' => 'dns01']]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/dns/providers/alidns/dns01', [
                'domain' => 'example.com',
                'record_name' => '_acme-challenge.example.com',
                'record_value' => 'token-value',
            ])
            ->assertOk();
    }
}
