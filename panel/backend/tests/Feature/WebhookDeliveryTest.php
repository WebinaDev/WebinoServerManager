<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Modules\Webhooks\Entities\WebhookEndpoint;
use Tests\TestCase;

class WebhookDeliveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_test_action_posts_signed_payload_and_logs_delivery(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        Http::fake(['https://hooks.test/*' => Http::response('ok', 200)]);

        $user = User::factory()->create();
        $user->assignRole('admin');

        $endpoint = WebhookEndpoint::query()->create([
            'name' => 'test-hook',
            'url' => 'https://hooks.test/ci',
            'secret' => 's3cret',
            'events' => ['backup.completed'],
            'enabled' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/webhooks/{$endpoint->id}/test")
            ->assertOk();

        Http::assertSent(function ($request) {
            $body = $request->body();
            $sig = hash_hmac('sha256', $body, 's3cret');

            return $request->hasHeader('X-Webino-Signature', $sig);
        });

        $this->assertDatabaseHas('webhook_deliveries', [
            'endpoint_id' => $endpoint->id,
            'event' => 'webhook.test',
            'status' => 'success',
            'response_code' => 200,
        ]);
    }
}
