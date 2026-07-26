<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Modules\Runtimes\Entities\RuntimeProject;
use Modules\Runtimes\Entities\RuntimeVersion;
use Modules\Runtimes\Jobs\InstallRuntimeVersionJob;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class RuntimesApiTest extends TestCase
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

    public function test_versions_list_includes_seeded_catalog(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/runtimes/versions')
            ->assertOk()
            ->assertJsonFragment(['slug' => 'node-nvm'])
            ->assertJsonFragment(['slug' => 'python-distro']);
    }

    public function test_install_dispatches_job(): void
    {
        Bus::fake();

        $versionId = RuntimeVersion::query()->where('slug', 'node-nvm')->value('id');

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/runtimes/versions/'.$versionId.'/install')
            ->assertStatus(202);

        Bus::assertDispatched(InstallRuntimeVersionJob::class);
    }

    public function test_create_project(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/runtimes/projects', [
                'name' => 'demo-api',
                'runtime' => 'node',
                'work_dir' => 'apps/demo-api',
                'entry_script' => 'index.js',
            ])
            ->assertCreated()
            ->assertJsonPath('project.name', 'demo-api');

        $this->assertDatabaseHas('runtimes_projects', [
            'name' => 'demo-api',
            'runtime' => 'node',
        ]);
    }

    public function test_start_project_calls_agent(): void
    {
        $project = RuntimeProject::query()->create([
            'name' => 'demo-api',
            'runtime' => 'node',
            'work_dir' => 'apps/demo-api',
            'entry_script' => 'index.js',
            'status' => 'stopped',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/runtimes/projects/'.$project->id.'/start')
            ->assertOk()
            ->assertJsonPath('project.name', 'demo-api');
    }
}
