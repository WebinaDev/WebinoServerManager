<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class SslUploadTest extends TestCase
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

    public function test_upload_custom_cert(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/ssl/certificates', \Mockery::on(fn (array $p) => ($p['action'] ?? '') === 'upload_custom'))
                ->andReturn(['ok' => true, 'data' => ['issuer' => 'custom', 'cert_path' => '/etc/ssl/webino/test/fullchain.pem']]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/ssl/certificates/upload', [
                'domain' => 'custom.example.com',
                'cert_pem' => '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----',
                'key_pem' => '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----',
            ])
            ->assertCreated();
    }
}
