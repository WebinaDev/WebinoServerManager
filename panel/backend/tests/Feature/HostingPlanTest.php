<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Hosting\Entities\HostingPlan;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class HostingPlanTest extends TestCase
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

    public function test_store_creates_plan(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/hosting/plans', [
                'name' => 'Starter',
                'disk_mb' => 512,
                'max_domains' => 1,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('hosting_plans', ['name' => 'Starter', 'slug' => 'starter']);
    }

    public function test_index_lists_plans(): void
    {
        HostingPlan::query()->create([
            'name' => 'Pro',
            'slug' => 'pro',
            'disk_mb' => 2048,
            'bandwidth_mb' => 20480,
            'inodes' => 200000,
            'max_domains' => 5,
            'max_subdomains' => 10,
            'max_databases' => 5,
            'max_mailboxes' => 10,
            'max_ftp' => 5,
            'max_cron' => 10,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/hosting/plans')
            ->assertOk()
            ->assertJsonCount(1, 'plans');
    }
}
