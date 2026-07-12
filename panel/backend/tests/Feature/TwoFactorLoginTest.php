<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class TwoFactorLoginTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private string $secret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->user = User::factory()->create(['password' => 'password1234']);
        $this->user->assignRole('admin');

        $google2fa = new Google2FA;
        $this->secret = $google2fa->generateSecretKey();
        $this->user->forceFill([
            'two_factor_secret' => encrypt($this->secret),
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => encrypt(json_encode(['RCODE-1111-AAAA'])),
        ])->save();
    }

    public function test_login_requires_otp_when_2fa_enabled(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'username' => $this->user->username,
            'password' => 'password1234',
        ])
            ->assertStatus(422)
            ->assertJsonPath('two_factor_required', true);
    }

    public function test_login_succeeds_with_valid_otp(): void
    {
        $otp = (new Google2FA)->getCurrentOtp($this->secret);

        $this->postJson('/api/v1/auth/login', [
            'username' => $this->user->username,
            'password' => 'password1234',
            'otp' => $otp,
        ])->assertOk();
    }

    public function test_login_succeeds_with_recovery_code(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'username' => $this->user->username,
            'password' => 'password1234',
            'recovery_code' => 'RCODE-1111-AAAA',
        ])->assertOk();

        $this->user->refresh();
        $codes = json_decode(decrypt($this->user->two_factor_recovery_codes), true);
        $this->assertNotContains('RCODE-1111-AAAA', $codes);
    }
}
