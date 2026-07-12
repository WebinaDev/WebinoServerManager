<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_crud_webhook_endpoints(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $create = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/webhooks', [
                'name' => 'ops',
                'url' => 'https://example.com/hook',
                'events' => ['backup.completed'],
            ])
            ->assertCreated()
            ->assertJsonPath('endpoint.name', 'ops');

        $id = $create->json('endpoint.id');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/webhooks')
            ->assertOk()
            ->assertJsonFragment(['name' => 'ops']);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/v1/webhooks/{$id}", ['enabled' => false])
            ->assertOk()
            ->assertJsonPath('endpoint.enabled', false);

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/v1/webhooks/{$id}")
            ->assertOk();

        $this->assertDatabaseMissing('webhook_endpoints', ['id' => $id]);
    }

    public function test_viewer_cannot_create_webhooks(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('viewer');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/webhooks', [
                'name' => 'blocked',
                'url' => 'https://example.com/hook',
                'events' => ['backup.completed'],
            ])
            ->assertForbidden();
    }
}
