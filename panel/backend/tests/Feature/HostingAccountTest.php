<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Entities\HostingPlan;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class HostingAccountTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockAgent();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_store_creates_account(): void
    {
        $plan = $this->makePlan();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/hosting/accounts', [
                'plan_id' => $plan->id,
                'username' => 'cust1',
                'primary_domain' => 'cust1.example.com',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('hosting_accounts', ['username' => 'cust1']);
    }

    public function test_usage_endpoint(): void
    {
        $plan = $this->makePlan();
        $account = HostingAccount::query()->create([
            'plan_id' => $plan->id,
            'username' => 'usage1',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/hosting/accounts/'.$account->id.'/usage')
            ->assertOk()
            ->assertJsonStructure(['account', 'usage']);
    }

    public function test_show_includes_summary_links(): void
    {
        $plan = $this->makePlan();
        $account = HostingAccount::query()->create([
            'plan_id' => $plan->id,
            'username' => 'show1',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/hosting/accounts/'.$account->id)
            ->assertOk()
            ->assertJsonPath('summary.links.domains', '/domains?account='.$account->id)
            ->assertJsonPath('summary.links.files', '/files?path='.urlencode('/var/www/show1'))
            ->assertJsonPath('summary.ftp_count', 0);
    }

    private function makePlan(): HostingPlan
    {
        return HostingPlan::query()->create([
            'name' => 'Basic',
            'slug' => 'basic',
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
    }
}
