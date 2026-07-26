<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Modules\Apps\Entities\DockerComposeProject;
use Modules\Softstore\Entities\SoftstorePackage;
use Modules\Softstore\Jobs\InstallSoftstorePackageJob;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class DockerDepthApiTest extends TestCase
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

    public function test_compose_store_creates_project(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/apps/compose', [
                'name' => 'demo',
                'compose_yaml' => "services:\n  web:\n    image: nginx:alpine\n",
            ])
            ->assertCreated()
            ->assertJsonPath('project.name', 'demo');

        $this->assertDatabaseHas('docker_compose_projects', [
            'name' => 'demo',
            'status' => 'active',
        ]);
    }

    public function test_networks_list(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/apps/networks')
            ->assertOk();
    }

    public function test_volumes_list(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/apps/volumes')
            ->assertOk();
    }

    public function test_daemon_show(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/apps/daemon')
            ->assertOk();
    }

    public function test_registry_store(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/apps/registries', [
                'name' => 'hub',
                'server' => 'https://index.docker.io/v1/',
                'username' => 'user',
                'password' => 'secret',
            ])
            ->assertCreated();

        $this->assertDatabaseCount('docker_registries', 1);
    }

    public function test_softstore_docker_package_seeded(): void
    {
        $this->assertNotNull(SoftstorePackage::query()->where('slug', 'docker-redis')->first());

        Bus::fake();
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/softstore/packages/docker-redis/install')
            ->assertStatus(202);
        Bus::assertDispatched(InstallSoftstorePackageJob::class);
    }

    public function test_compose_project_model(): void
    {
        DockerComposeProject::query()->create([
            'name' => 'x',
            'project_dir' => '/var/lib/webino/compose/x',
            'compose_yaml' => 'services: {}',
            'status' => 'active',
        ]);
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/apps/compose')
            ->assertOk()
            ->assertJsonCount(1, 'projects');
    }
}
