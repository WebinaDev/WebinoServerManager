<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Subdomains\Entities\HostingSubdomain;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class SubdomainsApiTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockAgent();
        $this->seed(RolesPermissionsSeeder::class);
        $this->user = User::factory()->create();
        $this->user->assignRole('admin');
    }

    public function test_index_returns_subdomains(): void
    {
        HostingSubdomain::query()->create([
            'parent_domain' => 'example.com',
            'subdomain' => 'www',
            'fqdn' => 'www.example.com',
            'document_root' => 'sites/www.example.com/public',
            'status' => 'active',
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/subdomains')
            ->assertOk()
            ->assertJsonCount(1, 'subdomains');
    }

    public function test_store_creates_subdomain_via_agent(): void
    {
        $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/subdomains', [
                'parent_domain' => 'example.com',
                'subdomain' => 'blog',
            ])
            ->assertCreated()
            ->assertJsonPath('subdomain.fqdn', 'blog.example.com');

        $this->assertDatabaseHas('hosting_subdomains', [
            'fqdn' => 'blog.example.com',
            'status' => 'active',
        ]);
    }

    public function test_destroy_removes_subdomain(): void
    {
        $subdomain = HostingSubdomain::query()->create([
            'parent_domain' => 'example.com',
            'subdomain' => 'api',
            'fqdn' => 'api.example.com',
            'document_root' => 'sites/api.example.com/public',
            'status' => 'active',
        ]);

        $this->actingAs($this->user, 'sanctum')
            ->deleteJson('/api/v1/subdomains/'.$subdomain->id)
            ->assertOk();

        $this->assertDatabaseMissing('hosting_subdomains', ['id' => $subdomain->id]);
    }
}
