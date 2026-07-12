<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UptimeSsrfTest extends TestCase
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

    public function test_http_uptime_rejects_metadata_ip(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/monitoring/uptime', [
                'name' => 'metadata probe',
                'target' => 'http://169.254.169.254/latest/meta-data/',
                'type' => 'http',
            ])
            ->assertUnprocessable();
    }

    public function test_tcp_uptime_rejects_private_ip(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/monitoring/uptime', [
                'name' => 'local redis',
                'target' => '127.0.0.1:6379',
                'type' => 'tcp',
            ])
            ->assertUnprocessable();
    }

    public function test_http_uptime_accepts_public_url(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/monitoring/uptime', [
                'name' => 'example',
                'target' => 'https://example.com',
                'type' => 'http',
            ])
            ->assertCreated();
    }

    public function test_http_uptime_rejects_hostname_without_dns(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/monitoring/uptime', [
                'name' => 'no dns',
                'target' => 'http://no-dns-records-xxxxx.invalid/',
                'type' => 'http',
            ])
            ->assertUnprocessable();
    }
}
