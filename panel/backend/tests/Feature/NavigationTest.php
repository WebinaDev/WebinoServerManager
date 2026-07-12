<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NavigationTest extends TestCase
{
    use RefreshDatabase;

    public function test_navigation_requires_auth(): void
    {
        $this->getJson('/api/v1/navigation')->assertUnauthorized();
    }

    public function test_navigation_returns_sections(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/navigation')
            ->assertOk()
            ->assertJsonStructure(['sections']);
    }

    public function test_viewer_navigation_hides_gated_items(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $response = $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/navigation')
            ->assertOk();

        $paths = collect($response->json('sections'))
            ->flatMap(fn (array $s) => collect($s['items'])->pluck('path'))
            ->all();

        $this->assertNotContains('/dns', $paths);
        $this->assertNotContains('/api-tokens', $paths);
        $this->assertNotContains('/files', $paths);
        $this->assertContains('/domains', $paths);
    }
}
