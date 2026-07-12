<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Email\Entities\MailDomain;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class MailAuthTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_generate_auth_records_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')->andReturnUsing(function (string $path) {
                if (str_contains($path, 'dkim')) {
                    return ['ok' => true, 'data' => [
                        'selector' => 'default',
                        'public_key' => 'ABC',
                        'txt_record' => 'v=DKIM1; k=rsa; p=ABC',
                    ]];
                }

                return ['ok' => true, 'data' => []];
            });
        });

        $domain = MailDomain::query()->create(['domain' => 'example.com', 'status' => 'active']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/email/domains/'.$domain->id.'/auth/generate')
            ->assertOk();

        $domain->refresh();
        $this->assertSame('default', $domain->dkim_selector);
    }
}
