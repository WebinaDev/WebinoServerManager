<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Hosting\Entities\HostingAccount;
use Tests\TestCase;

class EmbedScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
    }

    public function test_viewer_cannot_embed_unowned_database(): void
    {
        $owner = User::factory()->create();
        $account = HostingAccount::query()->create([
            'user_id' => $owner->id,
            'username' => 'site1',
            'primary_domain' => 'owned.example',
            'status' => 'active',
        ]);
        $db = HostingDatabase::query()->create([
            'name' => 'app_db',
            'db_user' => 'u_app',
            'hosting_account_id' => $account->id,
            'status' => 'active',
        ]);

        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');
        $viewer->givePermissionTo('embed.phpmyadmin');

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/v1/embed/phpmyadmin/ticket', ['database_id' => $db->id])
            ->assertForbidden();
    }

    public function test_admin_can_embed_any_database(): void
    {
        $db = HostingDatabase::query()->create([
            'name' => 'app_db',
            'db_user' => 'u_app',
            'status' => 'active',
        ]);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/embed/phpmyadmin/ticket', ['database_id' => $db->id])
            ->assertOk()
            ->assertJsonStructure(['data' => ['ticket', 'embed_path']]);
    }
}
