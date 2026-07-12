<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiTokenTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_and_list_scoped_token_with_expiry(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $expires = now()->addDay()->toIso8601String();

        $create = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/tokens', [
                'name' => 'ci-token',
                'abilities' => ['domains.manage'],
                'expires_at' => $expires,
            ])
            ->assertCreated()
            ->assertJsonStructure(['token', 'token_meta']);

        $plain = $create->json('token');
        $this->assertNotEmpty($plain);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/auth/tokens')
            ->assertOk()
            ->assertJsonPath('tokens.0.name', 'ci-token')
            ->assertJsonFragment(['domains.manage']);
    }

    public function test_user_can_revoke_own_token(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $token = $user->createToken('revoke-me', ['read']);
        $id = $token->accessToken->id;

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/v1/auth/tokens/{$id}")
            ->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $id]);
    }

    public function test_expired_token_is_rejected(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $access = $user->createToken('expired', ['*'], now()->subMinute());
        $plain = $access->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/auth/user')
            ->assertUnauthorized();
    }
}
