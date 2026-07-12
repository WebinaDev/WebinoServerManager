<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Databases\Entities\HostingDatabase;
use Tests\TestCase;

class DatabaseImportExportTest extends TestCase
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

    public function test_export_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/databases', \Mockery::on(fn (array $p) => ($p['action'] ?? '') === 'export'))
                ->andReturn(['ok' => true, 'data' => ['filename' => 'db-test.sql.gz']]);
        });

        $db = HostingDatabase::query()->create([
            'name' => 'exportdb',
            'engine' => 'mysql',
            'status' => 'active',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/databases/'.$db->id.'/export')
            ->assertOk();
    }

    public function test_import_calls_agent(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->once()
                ->with('/v1/databases', \Mockery::on(fn (array $p) => ($p['action'] ?? '') === 'import'))
                ->andReturn(['ok' => true, 'data' => []]);
        });

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/databases/import', [
                'name' => 'importdb',
                'file' => 'db-importdb.sql.gz',
            ])
            ->assertOk();
    }
}
