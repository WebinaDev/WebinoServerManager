<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Modules\Runtimes\Entities\RuntimeProject;
use Modules\Runtimes\Entities\RuntimeVersion;
use Modules\Runtimes\Jobs\InstallRuntimeVersionJob;
use Modules\Wordpress\Entities\WordpressSite;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class WordpressApiTest extends TestCase
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

    public function test_themes_list_calls_agent(): void
    {
        $site = WordpressSite::query()->create([
            'domain' => 'blog.example.com',
            'path' => 'sites/blog',
            'title' => 'Blog',
            'admin_user' => 'admin',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function ($mock) use ($site): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/wordpress', [
                    'action' => 'themes_list',
                    'path' => $site->path,
                ])
                ->andReturn(['ok' => true, 'data' => ['themes' => []]]);
            $mock->shouldReceive('get')->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('delete')->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/wordpress/'.$site->id.'/themes')
            ->assertOk()
            ->assertJsonPath('themes', []);
    }

    public function test_integrity_check(): void
    {
        $site = WordpressSite::query()->create([
            'domain' => 'blog.example.com',
            'path' => 'sites/blog',
            'title' => 'Blog',
            'admin_user' => 'admin',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function ($mock) use ($site): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/wordpress', [
                    'action' => 'integrity',
                    'path' => $site->path,
                ])
                ->andReturn(['ok' => true, 'data' => ['ok' => true, 'output' => 'Success']]);
            $mock->shouldReceive('get')->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('delete')->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/wordpress/'.$site->id.'/integrity')
            ->assertOk()
            ->assertJsonPath('integrity.ok', true);
    }

    public function test_clone_requires_write_permission(): void
    {
        $site = WordpressSite::query()->create([
            'domain' => 'blog.example.com',
            'path' => 'sites/blog',
            'title' => 'Blog',
            'admin_user' => 'admin',
            'status' => 'active',
        ]);

        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/v1/wordpress/'.$site->id.'/clone', ['target_path' => 'sites/clone'])
            ->assertForbidden();
    }
}
