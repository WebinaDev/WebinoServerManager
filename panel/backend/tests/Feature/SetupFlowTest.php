<?php

namespace Tests\Feature;

use App\Models\PanelSetting;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Core\Entities\SetupStackRun;
use Modules\Softstore\Providers\SoftstoreServiceProvider;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class SetupFlowTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SoftstoreServiceProvider::seedCatalog();
    }

    public function test_setup_status_is_public(): void
    {
        $this->getJson('/api/v1/setup/status')
            ->assertOk()
            ->assertJsonPath('data.needs_setup', true);
    }

    public function test_setup_skip_stack_completes_immediately(): void
    {
        $this->seed(RolesPermissionsSeeder::class);

        $this->postJson('/api/v1/setup', [
            'name' => 'Admin',
            'username' => 'admin',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'default_locale' => 'en',
            'panel_name' => 'WebinoServer',
            'stack' => ['skip' => true],
        ])->assertCreated()
            ->assertJsonPath('data.setup_completed', true);

        $this->assertDatabaseHas('users', ['username' => 'admin']);
        $this->assertTrue(PanelSetting::get('setup_completed') === true
            || PanelSetting::get('setup_completed') === '1'
            || PanelSetting::get('setup_completed') === 1);
        $this->getJson('/api/v1/setup/status')
            ->assertJsonPath('data.needs_setup', false);
    }

    public function test_setup_stack_installs_via_agent_then_completes(): void
    {
        $this->seed(RolesPermissionsSeeder::class);

        $this->mock(AgentClient::class, function ($mock): void {
            $mock->shouldReceive('post')
                ->atLeast()
                ->once()
                ->with('/v1/softstore/install', \Mockery::on(function (array $payload): bool {
                    return isset($payload['script_id']) && is_string($payload['script_id']);
                }))
                ->andReturn(['ok' => true, 'data' => ['log' => 'ok']]);
        });

        $this->postJson('/api/v1/setup', [
            'name' => 'Admin',
            'username' => 'admin',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'default_locale' => 'en',
            'panel_name' => 'WebinoServer',
            'stack' => [
                'webserver' => 'nginx',
                'database' => 'mariadb',
                'php_versions' => ['8.3'],
                'redis' => false,
                'memcached' => false,
                'pureftpd' => false,
            ],
        ])->assertCreated();

        $run = SetupStackRun::query()->latest('id')->first();
        $this->assertNotNull($run);
        $this->assertSame('success', $run->fresh()->status);
        $this->assertTrue(setup_completed());
        $this->getJson('/api/v1/setup/stack')
            ->assertOk()
            ->assertJsonPath('data.setup_completed', true)
            ->assertJsonPath('data.stack.status', 'success');
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
            'stack' => ['skip' => true],
        ];

        $this->postJson('/api/v1/setup', $payload)->assertCreated();
        $this->postJson('/api/v1/setup', $payload)->assertStatus(409);
    }
}
