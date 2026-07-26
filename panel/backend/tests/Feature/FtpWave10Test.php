<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Ftp\Entities\FtpAccount;
use Tests\TestCase;

class FtpWave10Test extends TestCase
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

    public function test_ftp_quota_update_calls_agent(): void
    {
        $account = FtpAccount::query()->create([
            'username' => 'ftpuser1',
            'home_dir' => '/var/www/ftpuser1',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/ftp/accounts', \Mockery::on(function (array $payload): bool {
                    return ($payload['action'] ?? '') === 'set_quota'
                        && ($payload['quota_mb'] ?? 0) === 512;
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/v1/ftp/accounts/{$account->id}/quota", ['quota_mb' => 512])
            ->assertOk()
            ->assertJsonPath('account.quota_mb', 512);
    }
}
