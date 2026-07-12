<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Ssl\Entities\SslCertificate;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class SslRenewTest extends TestCase
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

    public function test_renew_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/ssl/certificates', \Mockery::on(fn (array $p) => ($p['action'] ?? '') === 'renew'))
                ->andReturn(['ok' => true, 'data' => ['expires_at' => now()->addMonths(3)->toIso8601String()]]);
        });

        $cert = SslCertificate::query()->create([
            'domain' => 'example.com',
            'status' => 'active',
            'auto_renew' => true,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/ssl/certificates/'.$cert->id.'/renew')
            ->assertOk();
    }
}
