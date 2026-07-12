<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class DatabaseUserTest extends TestCase
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

    public function test_create_database_user(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->twice()
                ->with('/v1/databases/users', \Mockery::type('array'))
                ->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('get')->andReturn(['ok' => true, 'data' => ['users' => []]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/databases/users', [
                'username' => 'dbuser1',
                'password' => 'secretpass1',
                'host' => 'localhost',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('database_users', ['username' => 'dbuser1']);
    }
}
