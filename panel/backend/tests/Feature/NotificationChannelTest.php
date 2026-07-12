<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Modules\Monitoring\Entities\NotificationChannel;
use Tests\TestCase;

class NotificationChannelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_channel_crud(): void
    {
        $create = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/monitoring/channels', [
                'name' => 'Ops Telegram',
                'type' => 'telegram',
                'config' => ['bot_token' => 'token', 'chat_id' => '123'],
            ])
            ->assertCreated();

        $id = $create->json('channel.id');

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/monitoring/channels')
            ->assertOk()
            ->assertJsonCount(1, 'channels');

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/v1/monitoring/channels/{$id}", ['enabled' => false])
            ->assertOk()
            ->assertJsonPath('channel.enabled', false);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/v1/monitoring/channels/{$id}")
            ->assertOk();

        $this->assertDatabaseMissing('notification_channels', ['id' => $id]);
    }

    public function test_channel_test_dispatches_telegram(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        $channel = NotificationChannel::query()->create([
            'name' => 'Telegram',
            'type' => 'telegram',
            'config' => ['bot_token' => 'test-token', 'chat_id' => '999'],
            'enabled' => true,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/v1/monitoring/channels/{$channel->id}/test")
            ->assertOk();

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'api.telegram.org')
                && $request['chat_id'] === '999';
        });
    }

    public function test_slack_webhook_rejects_private_url(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/monitoring/channels', [
                'name' => 'Bad Slack',
                'type' => 'slack',
                'config' => ['webhook_url' => 'http://127.0.0.1/hook'],
            ])
            ->assertUnprocessable();
    }
}
