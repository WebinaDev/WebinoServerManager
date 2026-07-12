<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Embed\EmbedTicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Databases\Entities\HostingDatabase;
use Tests\TestCase;

class EmbedTicketTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['webino.agent.token' => 'test-embed-secret']);
        $this->seed(RolesPermissionsSeeder::class);
    }

    public function test_phpmyadmin_ticket_requires_auth(): void
    {
        $this->postJson('/api/v1/embeds/phpmyadmin/ticket')->assertUnauthorized();
    }

    public function test_phpmyadmin_verify_rejects_bad_token(): void
    {
        $this->getJson('/api/v1/embeds/phpmyadmin/verify?ticket=bad')
            ->assertUnauthorized();
    }

    public function test_phpmyadmin_ticket_and_verify_round_trip(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');

        $db = HostingDatabase::query()->create([
            'name' => 'app_db',
            'db_user' => 'app_user',
            'db_password_encrypted' => encrypt('secret'),
            'status' => 'active',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/embeds/phpmyadmin/ticket', ['database_id' => $db->id])
            ->assertOk();

        $ticket = $response->json('data.ticket');
        $this->assertNotEmpty($ticket);

        $this->withHeader('X-Embed-Token', 'test-embed-secret')
            ->getJson('/api/v1/embeds/phpmyadmin/verify?ticket='.urlencode($ticket))
            ->assertOk()
            ->assertJsonPath('data.user', 'app_user')
            ->assertJsonPath('data.db', 'app_db');
    }

    public function test_expired_ticket_is_rejected(): void
    {
        $payloadB64 = base64_encode(json_encode([
            'type' => 'phpmyadmin',
            'uid' => 1,
            'exp' => time() - 10,
        ], JSON_THROW_ON_ERROR));
        $sig = hash_hmac('sha256', $payloadB64, 'test-embed-secret');
        $ticket = $payloadB64.'.'.$sig;

        $this->withHeader('X-Embed-Token', 'test-embed-secret')
            ->getJson('/api/v1/embeds/phpmyadmin/verify?ticket='.urlencode($ticket))
            ->assertForbidden();
    }
}
