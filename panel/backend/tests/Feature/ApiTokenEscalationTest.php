<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiTokenEscalationTest extends TestCase
{
    use RefreshDatabase;

    public function test_scoped_token_cannot_mint_broader_token(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $plain = $user->createToken('domains-only', ['read', 'domains.manage'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->postJson('/api/v1/auth/tokens', [
                'name' => 'escalation',
                'abilities' => ['system.manage'],
            ])
            ->assertStatus(422);

        $this->assertDatabaseMissing('personal_access_tokens', ['name' => 'escalation']);
    }

    public function test_scoped_token_lists_only_grantable_abilities(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $plain = $user->createToken('domains-only', ['read', 'domains.manage'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/auth/tokens')
            ->assertForbidden();
    }

    public function test_token_with_tokens_manage_can_list(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $plain = $user->createToken('tokens', ['read', 'tokens.manage'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/auth/tokens')
            ->assertOk();
    }
}
