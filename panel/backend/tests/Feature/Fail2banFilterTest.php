<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class Fail2banFilterTest extends TestCase
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

    public function test_admin_can_list_fail2ban_filters(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/security/fail2ban/filters')
                ->andReturn([
                    'ok' => true,
                    'data' => ['filters' => [['name' => 'sshd.conf', 'path' => '/etc/fail2ban/filter.d/sshd.conf']]],
                ]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/security/fail2ban/filters')
            ->assertOk()
            ->assertJsonPath('filters.0.name', 'sshd.conf');
    }

    public function test_admin_can_save_fail2ban_filter(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/security/fail2ban/filters', [
                    'name' => 'custom.conf',
                    'content' => '[Definition]\nfailregex = .*\n',
                    'action' => 'save',
                ])
                ->andReturn(['ok' => true, 'data' => ['saved' => true]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/security/fail2ban/filters', [
                'name' => 'custom.conf',
                'content' => "[Definition]\nfailregex = .*\n",
            ])
            ->assertOk();
    }
}
