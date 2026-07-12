<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class SetupFlowTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    public function test_setup_status_is_public(): void
    {
        $this->getJson('/api/v1/setup/status')
            ->assertOk()
            ->assertJsonPath('data.needs_setup', true);
    }

    public function test_setup_creates_admin(): void
    {
        $this->seed(RolesPermissionsSeeder::class);

        $this->postJson('/api/v1/setup', [
            'name' => 'Admin',
            'username' => 'admin',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'default_locale' => 'en',
            'panel_name' => 'WebinoServer',
        ])->assertCreated();

        $this->assertDatabaseHas('users', ['username' => 'admin']);
        $this->getJson('/api/v1/setup/status')
            ->assertJsonPath('data.needs_setup', false);
    }

    public function test_setup_rejects_duplicate_submit(): void
    {
        $this->seed(RolesPermissionsSeeder::class);

        $payload = [
            'name' => 'Admin',
            'username' => 'admin',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'default_locale' => 'en',
            'panel_name' => 'WebinoServer',
        ];

        $this->postJson('/api/v1/setup', $payload)->assertCreated();
        $this->postJson('/api/v1/setup', $payload)->assertStatus(409);
    }
}
