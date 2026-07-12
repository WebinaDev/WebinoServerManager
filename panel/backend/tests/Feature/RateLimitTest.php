<?php

namespace Tests\Feature;

use App\Models\PanelSetting;
use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_token_rate_limit_returns_429_with_headers(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        PanelSetting::set('api_rate_limit_per_minute', 2);

        $user = User::factory()->create();
        $user->assignRole('admin');
        $plain = $user->createToken('rate-test', ['*'])->plainTextToken;

        RateLimiter::clear('api-token:'.$user->tokens()->first()->id);

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/auth/user')
            ->assertOk()
            ->assertHeader('X-RateLimit-Limit', '2');

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/auth/user')
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/v1/auth/user')
            ->assertStatus(429)
            ->assertHeader('Retry-After')
            ->assertHeader('X-RateLimit-Remaining', '0');
    }
}
