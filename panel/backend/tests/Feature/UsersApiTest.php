<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UsersApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create(['username' => 'admin1']);
        $this->admin->assignRole('admin');
    }

    public function test_users_index_requires_permission(): void
    {
        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_create_user_with_role(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/users', [
                'name' => 'Operator',
                'username' => 'operator1',
                'email' => 'op@example.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => 'operator',
            ])
            ->assertCreated()
            ->assertJsonPath('user.username', 'operator1');

        $user = User::query()->where('username', 'operator1')->first();
        $this->assertTrue($user->hasRole('operator'));
    }

    public function test_cannot_delete_self(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/v1/users/'.$this->admin->id)
            ->assertStatus(422);
    }

    public function test_cannot_demote_last_admin(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/v1/users/'.$this->admin->id, ['role' => 'operator'])
            ->assertStatus(422);
    }

    public function test_roles_list(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/roles')
            ->assertOk()
            ->assertJsonStructure(['roles', 'permissions']);
    }

    public function test_create_custom_role(): void
    {
        $perm = Permission::firstOrCreate(['name' => 'domains.read', 'guard_name' => 'web']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/roles', [
                'name' => 'editor',
                'permissions' => [$perm->name],
            ])
            ->assertCreated()
            ->assertJsonPath('role.name', 'editor');

        $role = Role::query()->where('name', 'editor')->first();
        $this->assertNotNull($role);
        $this->assertTrue($role->hasPermissionTo($perm->name));
    }

    public function test_cannot_delete_admin_role(): void
    {
        $adminRole = Role::query()->where('name', 'admin')->first();

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/v1/roles/'.$adminRole->id)
            ->assertStatus(422);
    }

    public function test_cannot_create_role_named_admin(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/roles', [
                'name' => 'admin',
                'permissions' => [],
            ])
            ->assertStatus(422);
    }

    public function test_update_role_permissions(): void
    {
        $role = Role::create(['name' => 'custom-role', 'guard_name' => 'web']);
        $perm = Permission::firstOrCreate(['name' => 'domains.read', 'guard_name' => 'web']);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson('/api/v1/roles/'.$role->id, [
                'permissions' => [$perm->name],
            ])
            ->assertOk()
            ->assertJsonPath('role.name', 'custom-role');

        $this->assertTrue($role->fresh()->hasPermissionTo($perm->name));
    }

    public function test_delete_unused_custom_role(): void
    {
        $role = Role::create(['name' => 'disposable', 'guard_name' => 'web']);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/v1/roles/'.$role->id)
            ->assertOk();

        $this->assertNull(Role::query()->where('name', 'disposable')->first());
    }
}
