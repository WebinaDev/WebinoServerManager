<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Modules\Monitoring\Entities\UptimeCheck;
use Modules\Webhooks\Entities\WebhookEndpoint;
use Modules\Webhooks\Services\WebhookDispatcher;
use Tests\TestCase;

class RuntimeSsrfTest extends TestCase
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

    public function test_uptime_probe_skips_unsafe_runtime_target(): void
    {
        Http::fake();

        $check = UptimeCheck::query()->create([
            'name' => 'runtime ssrf',
            'target' => 'https://example.com',
            'type' => 'http',
            'interval_minutes' => 1,
            'enabled' => true,
        ]);

        $check->update(['target' => 'http://169.254.169.254/latest/meta-data/']);

        $this->artisan('panel:check-uptime')->assertSuccessful();

        Http::assertNothingSent();
    }

    public function test_webhook_dispatch_skips_unsafe_runtime_url(): void
    {
        Http::fake();

        $endpoint = WebhookEndpoint::query()->create([
            'name' => 'test',
            'url' => 'https://example.com/hook',
            'secret' => 'secret',
            'events' => ['alert.fired'],
            'enabled' => true,
        ]);

        $endpoint->update(['url' => 'http://169.254.169.254/']);

        app(WebhookDispatcher::class)->deliver($endpoint, 'alert.fired', ['x' => 1]);

        Http::assertNothingSent();
    }
}
