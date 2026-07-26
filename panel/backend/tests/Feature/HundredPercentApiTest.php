<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Files\Entities\FileShare;
use Tests\TestCase;

class HundredPercentApiTest extends TestCase
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

    public function test_files_recycle_and_versions_proxied(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/files', \Mockery::on(fn ($b) => ($b['action'] ?? '') === 'recycle_list'))
                ->andReturn(['ok' => true, 'data' => ['items' => []]]);
            $mock->shouldReceive('post')
                ->with('/v1/files', \Mockery::on(fn ($b) => ($b['action'] ?? '') === 'versions'))
                ->andReturn(['ok' => true, 'data' => ['versions' => ['v1']]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/files/recycle')
            ->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/files/versions', ['path' => '/index.html'])
            ->assertOk()
            ->assertJsonPath('versions.0', 'v1');
    }

    public function test_files_share_download_public(): void
    {
        $share = FileShare::query()->create([
            'token' => str_repeat('ab', 24),
            'path' => '/hello.txt',
            'expires_at' => now()->addHour(),
            'created_by' => $this->admin->id,
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/files', \Mockery::on(fn ($b) => ($b['action'] ?? '') === 'read'))
                ->andReturn(['ok' => true, 'data' => ['content' => 'hi']]);
        });

        $this->call('GET', '/v1/files/share/'.$share->token)
            ->assertOk();
    }

    public function test_security_risk_fix_and_ignore(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/security/risks', \Mockery::subset(['action' => 'fix']))
                ->andReturn(['ok' => true, 'data' => ['id' => 'firewall_active']]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/security/risks/fix', ['id' => 'firewall_active'])
            ->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/security/risks/ignore', ['id' => 'world_writable'])
            ->assertOk();
    }

    public function test_dns_cloudflare_show(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/dns/providers/cloudflare')
            ->assertOk();
    }

    public function test_panel_settings_get(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/panel/settings')
                ->andReturn(['ok' => true, 'data' => ['http_port' => 2090]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/panel/settings')
            ->assertOk();
    }

    public function test_system_disk_endpoint(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/system/disk')
                ->andReturn(['ok' => true, 'data' => ['trees' => []]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/system/disk')
            ->assertOk();
    }
}
