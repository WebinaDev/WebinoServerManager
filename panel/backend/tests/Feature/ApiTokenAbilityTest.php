<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiTokenAbilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_scoped_token_can_read_but_not_mutate_out_of_scope(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $plain = $user->createToken('domains-only', ['read', 'domains.manage'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/domains')
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->postJson('/api/v1/databases', ['name' => 'blocked-db'])
            ->assertForbidden();
    }
}
