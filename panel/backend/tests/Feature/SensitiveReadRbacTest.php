<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Apps\Entities\DockerApp;
use Tests\TestCase;

class SensitiveReadRbacTest extends TestCase
{
    use RefreshDatabase;

    private User $viewer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->viewer = User::factory()->create();
        $this->viewer->assignRole('viewer');
    }

    public function test_viewer_cannot_read_audit_log_or_login_history(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/security/audit-log')
            ->assertForbidden();

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/security/login-history')
            ->assertForbidden();
    }

    public function test_viewer_cannot_read_security_posture_endpoints(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/security/firewall')
            ->assertForbidden();

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/security/sshkeys')
            ->assertForbidden();
    }

    public function test_viewer_cannot_read_monitoring_logs_or_channels(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/monitoring/logs/sources')
            ->assertForbidden();

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/monitoring/logs')
            ->assertForbidden();

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/monitoring/channels')
            ->assertForbidden();
    }

    public function test_viewer_cannot_read_monitoring_services_or_uptime(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/monitoring/services')
            ->assertForbidden();

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/monitoring/uptime')
            ->assertForbidden();
    }

    public function test_viewer_cannot_list_files_or_backup_targets_or_webhooks(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/files?path=/')
            ->assertForbidden();

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/backups/targets')
            ->assertForbidden();

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/webhooks')
            ->assertForbidden();
    }

    public function test_viewer_cannot_read_cron_jobs_or_email_queue(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/cron/jobs')
            ->assertForbidden();

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/email/queue')
            ->assertForbidden();
    }

    public function test_viewer_cannot_read_app_logs(): void
    {
        $app = DockerApp::query()->create([
            'name' => 'test',
            'image' => 'nginx:alpine',
            'container_name' => 'webino_test',
            'status' => 'running',
        ]);

        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/apps/'.$app->id.'/logs')
            ->assertForbidden();
    }

    public function test_viewer_cannot_mint_api_tokens(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->postJson('/api/v1/auth/tokens', [
                'name' => 'viewer-token',
                'abilities' => ['read'],
            ])
            ->assertForbidden();
    }

    public function test_viewer_cannot_list_api_tokens(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/auth/tokens')
            ->assertForbidden();
    }

    public function test_admin_can_read_sensitive_routes(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/security/audit-log')
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/monitoring/channels')
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/backups/targets')
            ->assertOk();
    }

    public function test_viewer_navigation_hides_gated_items(): void
    {
        $response = $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/navigation')
            ->assertOk();

        $paths = collect($response->json('sections'))
            ->flatMap(fn (array $s) => collect($s['items'])->pluck('path'))
            ->all();

        $this->assertNotContains('/dns', $paths);
        $this->assertNotContains('/api-tokens', $paths);
        $this->assertNotContains('/files', $paths);
        $this->assertContains('/domains', $paths);
    }
}
