<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Websites\Entities\HostingWebsite;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class WebsiteApiTest extends TestCase
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

    public function test_index_returns_websites(): void
    {
        HostingWebsite::query()->create([
            'fqdn' => 'site.example.com',
            'type' => 'php',
            'document_root' => 'sites/site.example.com/public',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/websites')
            ->assertOk()
            ->assertJsonCount(1, 'websites');
    }

    public function test_store_creates_website_and_vhost(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/websites', [
                'fqdn' => 'blog.example.com',
                'type' => 'php',
                'rewrite_template' => 'wordpress',
                'aliases' => ['www.blog.example.com'],
                'hotlink_protect' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('website.fqdn', 'blog.example.com')
            ->assertJsonPath('website.rewrite_template', 'wordpress');

        $this->assertDatabaseHas('hosting_websites', [
            'fqdn' => 'blog.example.com',
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('nginx_vhosts', [
            'fqdn' => 'blog.example.com',
            'status' => 'active',
        ]);
    }

    public function test_store_creates_website_apache_engine(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/websites', [
                'fqdn' => 'apache.example.com',
                'type' => 'php',
                'engine' => 'apache',
                'http3' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('website.engine', 'apache')
            ->assertJsonPath('website.http3', false);
    }

    public function test_rewrite_templates_list(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/websites/rewrite-templates')
            ->assertOk()
            ->assertJsonStructure(['templates']);
    }
}
