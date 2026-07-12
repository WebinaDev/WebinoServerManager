<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Mockery\MockInterface;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Entities\HostingPlan;
use Modules\Hosting\Entities\HostingQuotaAlert;
use Modules\Monitoring\Services\NotificationDispatcher;
use Tests\TestCase;

class HostingQuotaAlertTest extends TestCase
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

    public function test_admin_can_manage_quota_alerts(): void
    {
        $plan = HostingPlan::query()->create([
            'name' => 'Pro',
            'slug' => 'pro',
            'disk_mb' => 1024,
            'bandwidth_mb' => 10240,
            'inodes' => 100000,
            'max_domains' => 10,
            'max_subdomains' => 10,
            'max_databases' => 10,
            'max_mailboxes' => 10,
            'max_ftp' => 10,
            'max_cron' => 10,
        ]);

        $account = HostingAccount::query()->create([
            'plan_id' => $plan->id,
            'username' => 'alertuser',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/v1/hosting/accounts/{$account->id}/quota-alerts", [
                'resource' => 'disk',
                'threshold_percent' => 80,
                'escalation_minutes' => 30,
                'escalation_channel' => 'email',
            ])
            ->assertCreated()
            ->assertJsonPath('alert.resource', 'disk');

        $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/v1/hosting/accounts/{$account->id}/quota-alerts")
            ->assertOk()
            ->assertJsonCount(1, 'alerts');
    }

    public function test_collect_usage_dispatches_quota_alert(): void
    {
        $plan = HostingPlan::query()->create([
            'name' => 'Small',
            'slug' => 'small',
            'disk_mb' => 100,
            'bandwidth_mb' => 1024,
            'inodes' => 10000,
            'max_domains' => 1,
            'max_subdomains' => 1,
            'max_databases' => 1,
            'max_mailboxes' => 1,
            'max_ftp' => 1,
            'max_cron' => 1,
        ]);

        $account = HostingAccount::query()->create([
            'plan_id' => $plan->id,
            'username' => 'diskheavy',
            'status' => 'active',
            'disk_used_mb' => 0,
            'inodes_used' => 0,
        ]);

        HostingQuotaAlert::query()->create([
            'hosting_account_id' => $account->id,
            'resource' => 'disk',
            'threshold_percent' => 80,
            'enabled' => true,
            'escalation_minutes' => 60,
            'escalation_channel' => 'email',
            'breach_count' => 0,
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/hosting/usage?account=diskheavy')
                ->andReturn([
                    'ok' => true,
                    'data' => ['disk_mb' => 90, 'inodes' => 100],
                ]);
        });

        $dispatched = false;
        $this->mock(NotificationDispatcher::class, function (MockInterface $mock) use (&$dispatched): void {
            $mock->shouldReceive('dispatch')
                ->once()
                ->andReturnUsing(function () use (&$dispatched): void {
                    $dispatched = true;
                });
        });

        Artisan::call('panel:collect-hosting-usage');

        $this->assertTrue($dispatched);
        $alert = HostingQuotaAlert::query()->where('hosting_account_id', $account->id)->first();
        $this->assertSame(1, $alert->breach_count);
        $this->assertNotNull($alert->last_notified_at);
    }
}
