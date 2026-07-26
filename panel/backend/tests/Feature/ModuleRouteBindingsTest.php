<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Wordpress\Entities\WordpressSite;
use Tests\TestCase;

/**
 * Proves module routes run SubstituteBindings so {database}/{site} resolve to real models.
 */
class ModuleRouteBindingsTest extends TestCase
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

    public function test_database_destroy_soft_deletes_via_route_binding(): void
    {
        $db = HostingDatabase::query()->create([
            'name' => 'bind_db',
            'db_user' => 'u_bind',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/v1/databases/'.$db->id)
            ->assertOk();

        $this->assertSoftDeleted('hosting_databases', ['id' => $db->id, 'name' => 'bind_db']);
        $this->assertNotNull($db->fresh()->deleted_at);
    }

    public function test_wordpress_integrity_sends_non_null_path_from_bound_site(): void
    {
        $site = WordpressSite::query()->create([
            'domain' => 'bind.example.com',
            'path' => 'sites/bound-blog',
            'title' => 'Bound',
            'admin_user' => 'admin',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function ($mock) use ($site): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/wordpress', \Mockery::on(function (array $payload) use ($site): bool {
                    return ($payload['action'] ?? '') === 'integrity'
                        && ($payload['path'] ?? null) === $site->path
                        && $payload['path'] !== null
                        && $payload['path'] !== '';
                }))
                ->andReturn(['ok' => true, 'data' => ['ok' => true]]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/wordpress/'.$site->id.'/integrity')
            ->assertOk();
    }
}
