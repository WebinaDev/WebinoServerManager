<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class FilesAdvancedApiTest extends TestCase
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

    public function test_search_proxies_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/files', \Mockery::on(fn ($b) => ($b['action'] ?? '') === 'search'))
                ->andReturn(['ok' => true, 'data' => ['hits' => [['path' => '/a.txt']]]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/files/search', ['query' => 'a', 'path' => '/'])
            ->assertOk()
            ->assertJsonPath('hits.0.path', '/a.txt');
    }

    public function test_create_share_token(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/files/shares', ['path' => '/index.html', 'expires_hours' => 2])
            ->assertCreated()
            ->assertJsonStructure(['share' => ['token'], 'url']);

        $this->assertDatabaseCount('file_shares', 1);
    }
}
