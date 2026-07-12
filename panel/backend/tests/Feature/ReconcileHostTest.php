<?php

namespace Tests\Feature;

use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Git\Entities\GitRepository;
use Tests\TestCase;

class ReconcileHostTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
    }

    public function test_marks_missing_database_as_drift(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/domains')
                ->andReturn(['ok' => true, 'data' => ['domains' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/databases')
                ->andReturn(['ok' => true, 'data' => ['databases' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/dns/zones')
                ->andReturn(['ok' => true, 'data' => ['zones' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/ssl/certificates')
                ->andReturn(['ok' => true, 'data' => ['certificates' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/ftp/accounts')
                ->andReturn(['ok' => true, 'data' => ['accounts' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/mail/accounts')
                ->andReturn(['ok' => true, 'data' => ['accounts' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/cron')
                ->andReturn(['ok' => true, 'data' => ['entries' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/backups')
                ->andReturn(['ok' => true, 'data' => ['backups' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/dns/records/counts')
                ->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('get')
                ->with('/v1/git')
                ->andReturn(['ok' => true, 'data' => ['repositories' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/wordpress')
                ->andReturn(['ok' => true, 'data' => ['sites' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/vhosts')
                ->andReturn(['ok' => true, 'data' => ['vhosts' => []]]);
        });

        $db = HostingDatabase::query()->create([
            'name' => 'orphan_db',
            'status' => 'active',
        ]);

        $this->artisan('panel:reconcile-host')->assertSuccessful();

        $db->refresh();
        $this->assertSame('drift', $db->status);
        $this->assertNotNull($db->last_error);
    }

    public function test_marks_missing_git_repository_as_drift(): void
    {
        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('get')
                ->with('/v1/domains')
                ->andReturn(['ok' => true, 'data' => ['domains' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/databases')
                ->andReturn(['ok' => true, 'data' => ['databases' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/dns/zones')
                ->andReturn(['ok' => true, 'data' => ['zones' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/dns/records/counts')
                ->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('get')
                ->with('/v1/ssl/certificates')
                ->andReturn(['ok' => true, 'data' => ['certificates' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/ftp/accounts')
                ->andReturn(['ok' => true, 'data' => ['accounts' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/mail/accounts')
                ->andReturn(['ok' => true, 'data' => ['accounts' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/cron')
                ->andReturn(['ok' => true, 'data' => ['entries' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/backups')
                ->andReturn(['ok' => true, 'data' => ['backups' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/git')
                ->andReturn(['ok' => true, 'data' => ['repositories' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/wordpress')
                ->andReturn(['ok' => true, 'data' => ['sites' => []]]);
            $mock->shouldReceive('get')
                ->with('/v1/vhosts')
                ->andReturn(['ok' => true, 'data' => ['vhosts' => []]]);
        });

        $repo = GitRepository::query()->create([
            'name' => 'demo',
            'repo_url' => 'https://github.com/example/demo.git',
            'branch' => 'main',
            'target_dir' => 'demo',
            'status' => 'active',
        ]);

        $this->artisan('panel:reconcile-host')->assertSuccessful();

        $repo->refresh();
        $this->assertSame('drift', $repo->status);
    }
}
