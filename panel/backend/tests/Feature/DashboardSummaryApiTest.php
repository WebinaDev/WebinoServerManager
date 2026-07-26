<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Metrics\Entities\MetricSample;
use Modules\Softstore\Entities\SoftstorePackage;
use Modules\Softstore\Entities\SoftstoreInstall;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class DashboardSummaryApiTest extends TestCase
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

    public function test_summary_includes_wave5_fields(): void
    {
        MetricSample::query()->create([
            'cpu_percent' => 10,
            'mem_percent' => 20,
            'disk_percent' => 30,
            'load1' => 0.5,
            'net_rx_bps' => 1000,
            'net_tx_bps' => 2000,
            'disk_read_bps' => 3000,
            'disk_write_bps' => 4000,
            'collected_at' => now(),
        ]);

        $pkg = SoftstorePackage::query()->where('slug', 'redis')->first();
        SoftstoreInstall::query()->create([
            'package_id' => $pkg->id,
            'status' => 'success',
            'requested_by' => $this->admin->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'domains',
                    'security_risk' => ['level', 'items'],
                    'softstore_recent_installs',
                    'softstore_active_installs',
                    'net_rx_bps',
                ],
            ]);
    }

    public function test_processes_list(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/monitoring/processes')
            ->assertOk();
    }
}
