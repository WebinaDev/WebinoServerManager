<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class SubdomainPhpPoolTest extends TestCase
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

    public function test_create_subdomain_passes_php_pool_to_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/subdomains', \Mockery::on(function (array $payload): bool {
                    return ($payload['php_pool'] ?? '') === 'blog_example'
                        && ($payload['ssl'] ?? false) === true;
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/subdomains', [
                'parent_domain' => 'example.com',
                'subdomain' => 'blog',
                'php_pool' => 'blog_example',
                'ssl_enabled' => true,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('hosting_subdomains', [
            'fqdn' => 'blog.example.com',
            'php_pool' => 'blog_example',
            'ssl_enabled' => true,
        ]);
    }
}
