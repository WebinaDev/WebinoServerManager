<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnforceTokenAbilitiesTest extends TestCase
{
    use RefreshDatabase;

    public function test_read_only_token_cannot_access_domains(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $plain = $user->createToken('read-only', ['read'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/domains')
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/auth/check')
            ->assertOk();
    }

    public function test_scoped_token_can_access_matching_prefix(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $plain = $user->createToken('domains', ['read', 'domains.manage'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/domains')
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/databases')
            ->assertForbidden();
    }
}
