<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Entities\HostingPlan;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class HostingSuspendTest extends TestCase
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

    public function test_suspend_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/hosting/suspend', \Mockery::on(fn (array $p) => $p['username'] === 'suspendme'))
                ->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('get')->andReturn(['ok' => true, 'data' => []]);
        });

        $plan = HostingPlan::query()->create([
            'name' => 'Basic',
            'slug' => 'basic-suspend',
            'disk_mb' => 1024,
            'bandwidth_mb' => 10240,
            'inodes' => 100000,
            'max_domains' => 1,
            'max_subdomains' => 5,
            'max_databases' => 2,
            'max_mailboxes' => 5,
            'max_ftp' => 2,
            'max_cron' => 5,
        ]);

        $account = HostingAccount::query()->create([
            'plan_id' => $plan->id,
            'username' => 'suspendme',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/hosting/accounts/'.$account->id.'/suspend')
            ->assertOk();

        $this->assertDatabaseHas('hosting_accounts', [
            'id' => $account->id,
            'status' => 'suspended',
        ]);
    }
}
