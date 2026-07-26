<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Modules\Softstore\Entities\SoftstorePackage;
use Modules\Softstore\Jobs\InstallSoftstorePackageJob;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class SoftstoreApiTest extends TestCase
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

    public function test_packages_list_includes_seeded_catalog(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/softstore/packages')
            ->assertOk()
            ->assertJsonFragment(['slug' => 'redis'])
            ->assertJsonFragment(['slug' => 'composer']);
    }

    public function test_install_dispatches_job(): void
    {
        Bus::fake();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/softstore/packages/redis/install')
            ->assertStatus(202)
            ->assertJsonPath('install.status', 'pending');

        Bus::assertDispatched(InstallSoftstorePackageJob::class);
        $this->assertDatabaseHas('softstore_installs', [
            'status' => 'pending',
            'package_id' => SoftstorePackage::query()->where('slug', 'redis')->value('id'),
        ]);
    }

    public function test_pin_and_unpin(): void
    {
        $packageId = SoftstorePackage::query()->where('slug', 'redis')->value('id');

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/softstore/pins', ['package_id' => $packageId])
            ->assertCreated();

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/softstore/pins')
            ->assertOk()
            ->assertJsonCount(1, 'pins');

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.softstore_pins.0.slug', 'redis');

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/v1/softstore/pins/'.$packageId)
            ->assertOk();
    }

    public function test_cms_stub_requires_website(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/softstore/packages/cms-stub/install')
            ->assertStatus(422);
    }
}
