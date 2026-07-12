<?php

namespace Tests\Feature;

use App\Models\PanelSetting;
use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        PanelSetting::set('setup_completed', true);
    }

    public function test_forgot_password_returns_generic_success_without_enumeration(): void
    {
        User::factory()->create([
            'username' => 'known',
            'email' => 'known@example.com',
            'password' => 'secret1234',
        ]);

        $this->postJson('/api/v1/auth/forgot-password', ['username' => 'known'])
            ->assertOk()
            ->assertJsonStructure(['message']);

        $this->postJson('/api/v1/auth/forgot-password', ['username' => 'missing'])
            ->assertOk()
            ->assertJsonStructure(['message']);
    }

    public function test_reset_password_changes_password_with_valid_token(): void
    {
        $user = User::factory()->create([
            'username' => 'resetme',
            'email' => 'reset@example.com',
            'password' => 'oldpassword1',
        ]);

        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'newpassword1',
            'password_confirmation' => 'newpassword1',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('newpassword1', $user->password));
    }

    public function test_mail_status_endpoint_is_public(): void
    {
        $this->getJson('/api/v1/mail/status')
            ->assertOk()
            ->assertJsonPath('data.configured', false);
    }
}
