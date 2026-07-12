<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class PhpIniTest extends TestCase
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

    public function test_admin_can_read_and_update_php_ini(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/php/ini?version=8.3')
                ->andReturn([
                    'ok' => true,
                    'data' => ['version' => '8.3', 'content' => 'memory_limit=128M'],
                ]);
            $mock->shouldReceive('post')
                ->with('/v1/php/ini', ['version' => '8.3', 'content' => 'memory_limit=256M'])
                ->andReturn(['ok' => true, 'data' => ['saved' => true]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/php/ini?version=8.3')
            ->assertOk()
            ->assertJsonPath('content', 'memory_limit=128M');

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/php/ini', [
                'version' => '8.3',
                'content' => 'memory_limit=256M',
            ])
            ->assertOk();
    }

    public function test_admin_can_toggle_php_extension(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/php/extensions', [
                    'version' => '8.3',
                    'extension' => 'curl',
                    'action' => 'enable',
                ])
                ->andReturn(['ok' => true, 'data' => ['extension' => 'curl', 'enabled' => true]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/php/extensions', [
                'version' => '8.3',
                'extension' => 'curl',
                'action' => 'enable',
            ])
            ->assertOk();
    }
}
