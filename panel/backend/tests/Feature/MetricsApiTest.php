<?php

namespace Tests\Feature;

use App\Models\PanelSetting;
use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Metrics\Entities\MetricAlert;
use Modules\Metrics\Entities\MetricSample;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class MetricsApiTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockAgent();
        $this->seed(RolesPermissionsSeeder::class);
        PanelSetting::set('setup_completed', true);
        $this->user = User::factory()->create();
        $this->user->assignRole('admin');
    }

    public function test_current_returns_latest_sample(): void
    {
        MetricSample::query()->create([
            'cpu_percent' => 42.5,
            'mem_percent' => 60,
            'disk_percent' => 70,
            'load1' => 1.2,
            'collected_at' => now(),
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/metrics/current')
            ->assertOk()
            ->assertJsonPath('sample.cpu_percent', 42.5);
    }

    public function test_stale_sample_fetches_live_current(): void
    {
        MetricSample::query()->create([
            'cpu_percent' => 42.5,
            'mem_percent' => 60,
            'disk_percent' => 70,
            'load1' => 1.2,
            'collected_at' => now()->subMinutes(10),
        ]);

        $this->mock(\App\Services\Agent\AgentClient::class, function (\Mockery\MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/system/info')
                ->andReturn([
                    'ok' => true,
                    'data' => [
                        'cpu_percent' => 88.0,
                        'mem_percent' => 55.0,
                        'disk_percent' => 33.0,
                    ],
                ]);
        });

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/metrics/current')
            ->assertOk()
            ->assertJsonPath('sample.cpu_percent', 42.5)
            ->assertJsonPath('current.cpu_percent', 88.0);
    }

    public function test_history_returns_samples_in_range(): void
    {
        MetricSample::query()->create([
            'cpu_percent' => 10,
            'mem_percent' => 20,
            'disk_percent' => 30,
            'load1' => 0.5,
            'collected_at' => now()->subMinutes(5),
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/metrics/history?range=1h')
            ->assertOk()
            ->assertJsonCount(1, 'samples');
    }

    public function test_alert_crud(): void
    {
        $create = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/metrics/alerts', [
                'metric' => 'cpu',
                'comparison' => 'gt',
                'threshold' => 90,
                'cooldown_minutes' => 30,
            ])
            ->assertCreated();

        $id = $create->json('alert.id');

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/metrics/alerts')
            ->assertOk()
            ->assertJsonCount(1, 'alerts');

        $this->actingAs($this->user, 'sanctum')
            ->patchJson("/api/v1/metrics/alerts/{$id}", ['enabled' => false])
            ->assertOk()
            ->assertJsonPath('alert.enabled', false);

        $this->actingAs($this->user, 'sanctum')
            ->deleteJson("/api/v1/metrics/alerts/{$id}")
            ->assertOk();

        $this->assertDatabaseMissing('metric_alerts', ['id' => $id]);
    }

    public function test_collect_command_stores_sample(): void
    {
        MetricAlert::query()->create([
            'metric' => 'cpu',
            'comparison' => 'gt',
            'threshold' => 50,
            'enabled' => true,
            'channel' => 'email',
            'cooldown_minutes' => 60,
        ]);

        $this->artisan('panel:collect-metrics')->assertSuccessful();
        $this->assertDatabaseCount('metric_samples', 1);
    }
}
