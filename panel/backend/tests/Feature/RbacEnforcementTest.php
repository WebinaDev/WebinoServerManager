<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RbacEnforcementTest extends TestCase
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

    public function test_viewer_can_list_domains_but_not_create(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/domains')
            ->assertOk();

        $this->actingAs($this->viewer, 'sanctum')
            ->postJson('/api/v1/domains', ['domain' => 'test.example.com'])
            ->assertForbidden();
    }

    public function test_viewer_can_list_databases_but_not_create(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/databases')
            ->assertOk();

        $this->actingAs($this->viewer, 'sanctum')
            ->postJson('/api/v1/databases', ['name' => 'testdb'])
            ->assertForbidden();
    }

    public function test_viewer_can_read_metrics_but_not_create_alert(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->getJson('/api/v1/metrics/current')
            ->assertOk();

        $this->actingAs($this->viewer, 'sanctum')
            ->postJson('/api/v1/metrics/alerts', [
                'metric' => 'cpu',
                'comparison' => 'gt',
                'threshold' => 90,
            ])
            ->assertForbidden();
    }

    public function test_viewer_cannot_use_terminal(): void
    {
        $this->actingAs($this->viewer, 'sanctum')
            ->postJson('/api/v1/terminal/ticket')
            ->assertForbidden();
    }
}
