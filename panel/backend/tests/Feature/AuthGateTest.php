<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthGateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
    }

    public function test_gate_reports_setup_and_unauthenticated_without_cookie(): void
    {
        $this->getJson('/api/v1/auth/gate')
            ->assertOk()
            ->assertJsonPath('data.needs_setup', true)
            ->assertJsonPath('data.authenticated', false);
    }

    public function test_gate_reports_authenticated_with_valid_cookie(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        $token = $user->createToken('panel', ['*'])->plainTextToken;

        $this->withCookie(config('auth.cookie_name', 'webino_auth_token'), $token)
            ->getJson('/api/v1/auth/gate')
            ->assertOk()
            ->assertJsonPath('data.authenticated', true);
    }
}
