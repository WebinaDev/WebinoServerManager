<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class PostgresDatabaseTest extends TestCase
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

    public function test_create_pgsql_database(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/databases', \Mockery::on(fn (array $p) => ($p['engine'] ?? '') === 'pgsql'))
                ->andReturn(['ok' => true, 'data' => ['name' => 'pgapp']]);
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/databases', \Mockery::on(fn (array $p) => ($p['action'] ?? '') === 'size'))
                ->andReturn(['ok' => true, 'data' => ['size_mb' => 1]]);
            $mock->shouldReceive('get')->andReturn(['ok' => true, 'data' => ['databases' => []]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/databases', [
                'name' => 'pgapp',
                'engine' => 'pgsql',
                'create_user' => false,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('hosting_databases', ['name' => 'pgapp', 'engine' => 'pgsql']);
    }
}
