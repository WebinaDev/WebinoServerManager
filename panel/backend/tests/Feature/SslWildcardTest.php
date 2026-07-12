<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class SslWildcardTest extends TestCase
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

    public function test_issue_wildcard_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/ssl/certificates', \Mockery::on(fn (array $p) => ($p['action'] ?? '') === 'issue_wildcard'))
                ->andReturn(['ok' => true, 'data' => ['domain' => 'example.com']]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/ssl/certificates/wildcard', ['domain' => 'example.com'])
            ->assertCreated();

        $this->assertDatabaseHas('ssl_certificates', [
            'domain' => 'example.com',
            'type' => 'wildcard',
            'challenge' => 'dns',
        ]);
    }
}
