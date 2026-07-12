<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Security\Entities\LoginHistory;
use Tests\TestCase;

class LoginThrottleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        User::factory()->create(['username' => 'testuser', 'password' => bcrypt('secret')]);
    }

    public function test_records_failed_login(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'username' => 'testuser',
                'password' => 'wrong',
            ]);
        }

        $this->assertDatabaseCount('login_history', 3);
        $this->assertTrue(
            LoginHistory::query()->where('success', false)->count() === 3
        );
    }
}
