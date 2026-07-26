<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Modules\Cron\Entities\CronJob;
use Modules\Ftp\Entities\FtpAccount;
use Modules\Metrics\Entities\MetricAlert;
use Tests\TestCase;

class PhaseDParityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        Sanctum::actingAs($this->admin);
    }

    public function test_monitoring_log_sources_include_groups(): void
    {
        $this->mock(\App\Services\Agent\AgentClient::class, function ($mock) {
            $mock->shouldReceive('get')
                ->with('/v1/logs')
                ->andReturn([
                    'ok' => true,
                    'data' => json_encode([
                        'sources' => ['nginx-error', 'ftp'],
                        'groups' => ['panel' => ['nginx-error'], 'site' => [], 'ftp' => ['ftp']],
                    ]),
                ]);
        });

        $this->getJson('/api/v1/monitoring/logs/sources')
            ->assertOk()
            ->assertJsonPath('groups.panel.0', 'nginx-error');
    }

    public function test_terminal_ticket_accepts_container(): void
    {
        config(['webino.agent.token' => 'test-secret-token']);

        $this->postJson('/api/v1/terminal/ticket', ['container' => 'webino-redis'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['ticket', 'ws_path']]);
    }

    public function test_ftp_password_route_exists(): void
    {
        $account = FtpAccount::query()->create([
            'username' => 'ftpuser1',
            'home_dir' => '/var/www/ftpuser1',
            'enabled' => true,
            'status' => 'active',
        ]);

        $this->mock(\App\Services\Agent\AgentClient::class, function ($mock) {
            $mock->shouldReceive('post')
                ->with('/v1/ftp/accounts', \Mockery::subset([
                    'action' => 'set_password',
                    'username' => 'ftpuser1',
                ]))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->patchJson("/api/v1/ftp/accounts/{$account->id}/password", [
            'password' => 'newpassword123',
        ])->assertOk();
    }

    public function test_cron_job_can_be_updated(): void
    {
        $job = CronJob::query()->create([
            'schedule' => '0 2 * * *',
            'command' => '/bin/true',
            'task_type' => 'shell',
            'status' => 'active',
        ]);

        $this->mock(\App\Services\Agent\AgentClient::class, function ($mock) {
            $mock->shouldReceive('post')
                ->with('/v1/cron', \Mockery::on(fn ($payload) => ($payload['action'] ?? '') === 'update'))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->patchJson("/api/v1/cron/jobs/{$job->id}", [
            'schedule' => '0 3 * * *',
            'command' => '/bin/false',
        ])
            ->assertOk()
            ->assertJsonPath('job.schedule', '0 3 * * *');
    }

    public function test_metric_alert_supports_severity(): void
    {
        $alert = MetricAlert::query()->create([
            'metric' => 'disk',
            'comparison' => 'gt',
            'threshold' => 90,
            'severity' => 'hard',
            'enabled' => true,
        ]);

        $this->getJson('/api/v1/metrics/alerts')
            ->assertOk()
            ->assertJsonFragment(['severity' => 'hard', 'id' => $alert->id]);
    }
}
