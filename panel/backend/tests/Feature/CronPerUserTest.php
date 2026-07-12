<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Entities\HostingPlan;
use Tests\TestCase;

class CronPerUserTest extends TestCase
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

    public function test_cron_job_passes_username_to_agent(): void
    {
        $plan = HostingPlan::query()->create([
            'name' => 'Basic',
            'slug' => 'basic',
            'disk_mb' => 1024,
            'bandwidth_mb' => 10240,
            'inodes' => 100000,
            'max_domains' => 5,
            'max_subdomains' => 5,
            'max_databases' => 5,
            'max_mailboxes' => 5,
            'max_ftp' => 5,
            'max_cron' => 5,
        ]);

        $account = HostingAccount::query()->create([
            'plan_id' => $plan->id,
            'username' => 'siteuser1',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/cron', \Mockery::on(function (array $payload): bool {
                    return ($payload['username'] ?? '') === 'siteuser1'
                        && ($payload['schedule'] ?? '') === '0 3 * * *'
                        && ($payload['action'] ?? '') === 'create';
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/cron/jobs', [
                'schedule' => '0 3 * * *',
                'command' => '/usr/bin/true',
                'hosting_account_id' => $account->id,
            ])
            ->assertCreated()
            ->assertJsonPath('job.hosting_account.username', 'siteuser1');
    }

    public function test_cron_quota_blocks_excess_jobs(): void
    {
        $plan = HostingPlan::query()->create([
            'name' => 'Tiny',
            'slug' => 'tiny',
            'disk_mb' => 512,
            'bandwidth_mb' => 5120,
            'inodes' => 50000,
            'max_domains' => 1,
            'max_subdomains' => 1,
            'max_databases' => 1,
            'max_mailboxes' => 1,
            'max_ftp' => 1,
            'max_cron' => 1,
        ]);

        $account = HostingAccount::query()->create([
            'plan_id' => $plan->id,
            'username' => 'cronquota',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')->once()->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/cron/jobs', [
                'schedule' => '0 1 * * *',
                'command' => '/bin/true',
                'hosting_account_id' => $account->id,
            ])
            ->assertCreated();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/cron/jobs', [
                'schedule' => '0 2 * * *',
                'command' => '/bin/true',
                'hosting_account_id' => $account->id,
            ])
            ->assertStatus(422);
    }
}
