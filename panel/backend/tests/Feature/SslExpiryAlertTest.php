<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Ssl\Console\Commands\CheckSslExpiryCommand;
use Modules\Ssl\Entities\SslCertificate;
use Tests\TestCase;

class SslExpiryAlertTest extends TestCase
{
    use RefreshDatabase;

    public function test_expiry_command_runs_without_error(): void
    {
        $this->seed(RolesPermissionsSeeder::class);

        SslCertificate::query()->create([
            'domain' => 'expiring.example.com',
            'status' => 'active',
            'expires_at' => now()->addDays(5),
            'alert_days' => 14,
        ]);

        $this->artisan(CheckSslExpiryCommand::class)->assertSuccessful();
    }
}
