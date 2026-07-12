<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Entities\HostingPlan;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class HostingQuotaTest extends TestCase
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

    public function test_database_create_blocked_when_quota_exceeded(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')->never();
            $mock->shouldReceive('get')->andReturn(['ok' => true, 'data' => ['databases' => []]]);
        });

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
            'username' => 'quota1',
            'status' => 'active',
        ]);

        HostingDatabase::query()->create([
            'name' => 'existing_db',
            'hosting_account_id' => $account->id,
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/databases', [
                'name' => 'new_db',
                'hosting_account_id' => $account->id,
            ])
            ->assertStatus(422);
    }
}
