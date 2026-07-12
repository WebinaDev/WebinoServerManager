<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Webserver\Entities\NginxVhost;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class VhostRedirectTest extends TestCase
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

    public function test_add_redirect_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/vhosts/app_example_com/redirects', \Mockery::on(function (array $payload): bool {
                    return ($payload['from'] ?? '') === '/old'
                        && ($payload['to'] ?? '') === 'https://example.com/new';
                }))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $vhost = NginxVhost::query()->create([
            'fqdn' => 'app.example.com',
            'config_name' => 'app_example_com',
            'document_root' => 'sites/app.example.com/public',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/webserver/vhosts/'.$vhost->id.'/redirects', [
                'from' => '/old',
                'to' => 'https://example.com/new',
                'code' => '301',
            ])
            ->assertOk();

        $this->assertCount(1, $vhost->fresh()->redirects ?? []);
    }
}
