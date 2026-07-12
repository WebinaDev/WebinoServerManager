<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\MocksAgent;
use Tests\TestCase;

class ModulesApiTest extends TestCase
{
    use MocksAgent;
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mockAgent();
        $this->seed(RolesPermissionsSeeder::class);
        $this->user = User::factory()->create();
        $this->user->assignRole('admin');
    }

  /**
   * @return array<string, array{0: string}>
   */
    public static function indexRoutesProvider(): array
    {
        return [
            'domains' => ['/api/v1/domains'],
            'databases' => ['/api/v1/databases'],
            'dns zones' => ['/api/v1/dns/zones'],
            'dns templates' => ['/api/v1/dns/templates'],
            'webserver vhosts' => ['/api/v1/webserver/vhosts'],
            'backup targets' => ['/api/v1/backups/targets'],
            'hosting plans' => ['/api/v1/hosting/plans'],
            'hosting accounts' => ['/api/v1/hosting/accounts'],
            'database users' => ['/api/v1/databases/users'],
            'ssl' => ['/api/v1/ssl/certificates'],
            'ftp' => ['/api/v1/ftp/accounts'],
            'php' => ['/api/v1/php/pools'],
            'email accounts' => ['/api/v1/email/accounts'],
            'email forwarders' => ['/api/v1/email/forwarders'],
            'email domains' => ['/api/v1/email/domains'],
            'subdomains' => ['/api/v1/subdomains'],
            'metrics current' => ['/api/v1/metrics/current'],
            'metrics alerts' => ['/api/v1/metrics/alerts'],
            'users' => ['/api/v1/users'],
            'roles' => ['/api/v1/roles'],
            'backup schedules' => ['/api/v1/backups/schedules'],
            'files' => ['/api/v1/files?path=/'],
            'cron' => ['/api/v1/cron/jobs'],
            'backups' => ['/api/v1/backups'],
            'system' => ['/api/v1/system/info'],
            'git' => ['/api/v1/git'],
            'wordpress' => ['/api/v1/wordpress'],
            'support' => ['/api/v1/support/tickets'],
            'platform status' => ['/api/v1/platform/status'],
            'sites' => ['/api/v1/sites'],
            'products' => ['/api/v1/products'],
            'security firewall' => ['/api/v1/security/firewall'],
            'security fail2ban' => ['/api/v1/security/fail2ban'],
            'security audit' => ['/api/v1/security/audit-log'],
            'email autoresponders' => ['/api/v1/email/autoresponders'],
            'email lists' => ['/api/v1/email/lists'],
            'email queue' => ['/api/v1/email/queue'],
            'email antispam' => ['/api/v1/email/antispam'],
            'apps' => ['/api/v1/apps'],
            'apps images' => ['/api/v1/apps/images'],
            'monitoring services' => ['/api/v1/monitoring/services'],
            'monitoring log sources' => ['/api/v1/monitoring/logs/sources'],
            'monitoring uptime' => ['/api/v1/monitoring/uptime'],
            'monitoring channels' => ['/api/v1/monitoring/channels'],
            'auth tokens' => ['/api/v1/auth/tokens'],
            'webhooks' => ['/api/v1/webhooks'],
        ];
    }

    #[DataProvider('indexRoutesProvider')]
    public function test_module_index_route(string $uri): void
    {
        $this->actingAs($this->user, 'sanctum')
            ->getJson($uri)
            ->assertOk();
    }

    public function test_openapi_json_is_public(): void
    {
        $this->getJson('/api/v1/openapi.json')->assertOk();
    }

    public function test_dashboard_summary(): void
    {
        $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonStructure(['data' => ['domains', 'databases', 'sites', 'system_status']]);
    }
}
