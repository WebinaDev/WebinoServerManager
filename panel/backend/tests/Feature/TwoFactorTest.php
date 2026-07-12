<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->user = User::factory()->create();
        $this->user->assignRole('admin');
    }

    public function test_enable_and_confirm_returns_recovery_codes(): void
    {
        $enable = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/auth/2fa/enable')
            ->assertOk();

        $secret = $enable->json('secret');
        $otp = (new Google2FA)->getCurrentOtp($secret);

        $confirm = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/auth/2fa/confirm', ['otp' => $otp])
            ->assertOk();

        $this->assertNotEmpty($confirm->json('recovery_codes'));
        $this->user->refresh();
        $this->assertNotNull($this->user->two_factor_recovery_codes);
    }
}
