<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Modules\Monitoring\Entities\UptimeCheck;
use Modules\Monitoring\Entities\UptimeResult;
use Tests\TestCase;

class UptimeCheckTest extends TestCase
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

    public function test_uptime_crud(): void
    {
        $create = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/monitoring/uptime', [
                'name' => 'Panel',
                'target' => 'https://example.com',
                'type' => 'http',
                'interval_minutes' => 5,
            ])
            ->assertCreated();

        $id = $create->json('check.id');

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/monitoring/uptime')
            ->assertOk()
            ->assertJsonCount(1, 'checks');

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/v1/monitoring/uptime/{$id}", ['enabled' => false])
            ->assertOk()
            ->assertJsonPath('check.enabled', false);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/v1/monitoring/uptime/{$id}")
            ->assertOk();

        $this->assertDatabaseMissing('uptime_checks', ['id' => $id]);
    }

    public function test_check_uptime_command_records_result(): void
    {
        Http::fake([
            'https://example.com' => Http::response('', 200),
        ]);

        UptimeCheck::query()->create([
            'name' => 'Example',
            'target' => 'https://example.com',
            'type' => 'http',
            'interval_minutes' => 5,
            'enabled' => true,
        ]);

        $this->artisan('panel:check-uptime')->assertSuccessful();

        $this->assertDatabaseCount('uptime_results', 1);
        $this->assertDatabaseHas('uptime_checks', ['last_status' => 'up']);
    }

    public function test_results_endpoint(): void
    {
        $check = UptimeCheck::query()->create([
            'name' => 'API',
            'target' => 'https://api.example.com',
            'type' => 'http',
            'enabled' => true,
        ]);

        UptimeResult::query()->create([
            'check_id' => $check->id,
            'status' => 'up',
            'latency_ms' => 42,
            'checked_at' => now(),
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/v1/monitoring/uptime/{$check->id}/results")
            ->assertOk()
            ->assertJsonCount(1, 'results');
    }
}
