<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_with_username(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create([
            'username' => 'operator',
            'password' => 'secret1234',
        ]);
        $user->assignRole('admin');

        $this->postJson('/api/v1/auth/login', [
            'username' => 'operator',
            'password' => 'secret1234',
        ])->assertOk();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/auth/check')
            ->assertOk();
    }
}
