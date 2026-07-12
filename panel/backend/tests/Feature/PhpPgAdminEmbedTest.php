<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Databases\Entities\HostingDatabase;
use Tests\TestCase;

class PhpPgAdminEmbedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['webino.agent.token' => 'test-embed-secret', 'webino.pgsql_host' => 'pgsql.local']);
        $this->seed(RolesPermissionsSeeder::class);
    }

    public function test_phppgadmin_ticket_requires_auth(): void
    {
        $this->postJson('/api/v1/embeds/phppgadmin/ticket')->assertUnauthorized();
    }

    public function test_phppgadmin_verify_rejects_bad_token(): void
    {
        $this->getJson('/api/v1/embeds/phppgadmin/verify?ticket=bad')
            ->assertUnauthorized();
    }

    public function test_phppgadmin_ticket_and_verify_round_trip(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');

        $db = HostingDatabase::query()->create([
            'name' => 'pg_app',
            'engine' => 'pgsql',
            'db_user' => 'pg_user',
            'db_password_encrypted' => encrypt('pg_secret'),
            'status' => 'active',
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/embeds/phppgadmin/ticket', ['database_id' => $db->id])
            ->assertOk();

        $ticket = $response->json('data.ticket');
        $this->assertNotEmpty($ticket);
        $this->assertStringContainsString('signon.php', (string) $response->json('data.embed_path'));

        $this->withHeader('X-Embed-Token', 'test-embed-secret')
            ->getJson('/api/v1/embeds/phppgadmin/verify?ticket='.urlencode($ticket))
            ->assertOk()
            ->assertJsonPath('data.user', 'pg_user')
            ->assertJsonPath('data.db', 'pg_app')
            ->assertJsonPath('data.host', 'pgsql.local');
    }

    public function test_phppgadmin_ticket_rejects_mysql_database(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');

        $db = HostingDatabase::query()->create([
            'name' => 'mysql_app',
            'engine' => 'mysql',
            'db_user' => 'mysql_user',
            'status' => 'active',
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/embeds/phppgadmin/ticket', ['database_id' => $db->id])
            ->assertStatus(422);
    }
}
