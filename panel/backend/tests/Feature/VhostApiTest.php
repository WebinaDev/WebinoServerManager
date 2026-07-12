<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Webserver\Entities\NginxVhost;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class VhostApiTest extends TestCase
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

    public function test_index_returns_vhosts(): void
    {
        NginxVhost::query()->create([
            'fqdn' => 'app.example.com',
            'config_name' => 'app_example_com',
            'document_root' => 'sites/app.example.com/public',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/webserver/vhosts')
            ->assertOk()
            ->assertJsonCount(1, 'vhosts');
    }

    public function test_store_creates_vhost(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/webserver/vhosts', [
                'fqdn' => 'blog.example.com',
            ])
            ->assertCreated()
            ->assertJsonPath('vhost.fqdn', 'blog.example.com');

        $this->assertDatabaseHas('nginx_vhosts', [
            'fqdn' => 'blog.example.com',
            'status' => 'active',
        ]);
    }
}
