<?php

namespace Tests\Feature;

use App\Services\Agent\AgentClient;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Modules\Backup\Entities\Backup;
use Modules\Backup\Entities\BackupTarget;
use Modules\Backup\Jobs\UploadOffsiteJob;
use Modules\Backup\Jobs\VerifyBackupJob;
use Tests\TestCase;

class BackupVerifyJobTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesPermissionsSeeder::class);
    }

    public function test_verify_job_retries_on_transient_agent_error(): void
    {
        $backup = Backup::query()->create([
            'trigger' => 'manual',
            'type' => 'db',
            'target' => 'mydb',
            'filename' => 'db-mydb.sql.gz',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/backups', \Mockery::type('array'))
                ->andReturn(['ok' => false, 'error' => 'connection refused']);
        });

        $job = new VerifyBackupJob($backup->id);
        $this->expectException(\RuntimeException::class);
        $job->handle(app(AgentClient::class));
    }

    public function test_verify_job_persists_permanent_error_without_throw(): void
    {
        $backup = Backup::query()->create([
            'trigger' => 'manual',
            'type' => 'db',
            'target' => 'mydb',
            'filename' => 'missing.sql.gz',
            'status' => 'active',
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/backups', \Mockery::type('array'))
                ->andReturn(['ok' => false, 'error' => 'backup file not found']);
        });

        $job = new VerifyBackupJob($backup->id);
        $job->handle(app(AgentClient::class));

        $backup->refresh();
        $this->assertSame('backup file not found', $backup->last_error);
    }

    public function test_upload_offsite_job_persists_last_error_on_failure(): void
    {
        $backup = Backup::query()->create([
            'trigger' => 'manual',
            'type' => 'db',
            'target' => 'mydb',
            'filename' => 'db-mydb.sql.gz',
            'status' => 'active',
        ]);
        $target = BackupTarget::query()->create([
            'name' => 'offsite',
            'driver' => 's3',
            'config' => ['bucket' => 'webino-backups', 'password' => 'secret'],
            'enabled' => true,
        ]);

        $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')
                ->with('/v1/backups', \Mockery::type('array'))
                ->andReturn(['ok' => false, 'error' => 'restic init failed']);
        });

        $job = new UploadOffsiteJob($backup->id, $target->id);
        $job->handle(app(AgentClient::class));

        $backup->refresh();
        $this->assertSame('restic init failed', $backup->last_error);
    }
}
