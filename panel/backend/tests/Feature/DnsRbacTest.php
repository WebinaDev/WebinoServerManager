<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DnsRbacTest extends TestCase
{
    use RefreshDatabase;

    public function test_viewer_can_list_dns_zones_but_not_create(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $viewer = User::factory()->create();
        $viewer->assignRole('viewer');

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/dns/zones')
            ->assertOk();

        $this->actingAs($viewer, 'sanctum')
            ->postJson('/api/v1/dns/zones', ['domain' => 'example.com'])
            ->assertForbidden();
    }
}
