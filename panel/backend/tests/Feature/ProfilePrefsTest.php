<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProfilePrefsTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_timezone_and_locale(): void
    {
        $this->seed(RolesPermissionsSeeder::class);
        $user = User::factory()->create(['timezone' => 'UTC', 'locale' => 'en']);
        $user->assignRole('admin');

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/v1/auth/profile', [
                'name' => 'Updated Name',
                'timezone' => 'Asia/Tehran',
                'locale' => 'fa',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Updated Name')
            ->assertJsonPath('timezone', 'Asia/Tehran')
            ->assertJsonPath('locale', 'fa');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/auth/user')
            ->assertOk()
            ->assertJsonPath('timezone', 'Asia/Tehran')
            ->assertJsonPath('locale', 'fa');
    }

    public function test_commerce_and_tenant_tables_are_dropped(): void
    {
        $tables = [
            'cart_items',
            'carts',
            'order_items',
            'orders',
            'payment_intents',
            'products',
            'categories',
            'marketing_campaigns',
            'cms_pages',
            'tenant_modules',
            'dashboard_modules',
            'tenants',
        ];

        foreach ($tables as $table) {
            $this->assertFalse(Schema::hasTable($table), "Table {$table} should be dropped");
        }

        $this->assertFalse(Schema::hasColumn('users', 'tenant_id'));
        $this->assertFalse(Schema::hasColumn('users', 'role'));
        $this->assertTrue(Schema::hasColumn('users', 'timezone'));
        $this->assertTrue(Schema::hasColumn('users', 'locale'));
    }
}
