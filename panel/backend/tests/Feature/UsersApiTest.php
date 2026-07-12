<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
