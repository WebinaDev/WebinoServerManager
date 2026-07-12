<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Email\Entities\MailAccount;
use Modules\Git\Entities\GitRepository;
use Tests\TestCase;

class EmailBulkQuotaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
    }

    public function test_index_accounts_uses_single_bulk_quota_call(): void
    {
        MailAccount::query()->create([
            'address' => 'a@example.com',
            'quota_mb' => 1024,
            'status' => 'active',
        ]);
        MailAccount::query()->create([
            'address' => 'b@example.com',
            'quota_mb' => 1024,
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->once()
                ->with(\Mockery::on(fn (string $path): bool => str_starts_with($path, '/v1/mail/quota?addresses=')))
                ->andReturn([
                    'ok' => true,
                    'data' => [
                        'a@example.com' => ['used' => 10],
                        'b@example.com' => ['used' => 20],
                    ],
                ]);
        });

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/email/accounts')
            ->assertOk()
            ->assertJsonPath('accounts.0.quota_usage.used', 10)
            ->assertJsonPath('accounts.1.quota_usage.used', 20);
    }
}
