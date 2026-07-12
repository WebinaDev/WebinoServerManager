<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'domains.manage',
            'databases.manage',
            'platform.manage',
            'system.manage',
            'security.manage',
            'users.manage',
            'hosting.manage',
            'apps.manage',
            'monitoring.manage',
            'webhooks.manage',
            'tokens.manage',
            'embed.phpmyadmin',
            'embed.phppgadmin',
            'embed.webmail',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $adminRole->syncPermissions(Permission::all());

        $operatorRole = Role::firstOrCreate(['name' => 'operator', 'guard_name' => 'web']);
        $operatorRole->syncPermissions([
            'domains.manage',
            'databases.manage',
            'platform.manage',
            'system.manage',
            'security.manage',
            'hosting.manage',
            'apps.manage',
            'monitoring.manage',
            'webhooks.manage',
            'tokens.manage',
            'embed.phpmyadmin',
            'embed.phppgadmin',
            'embed.webmail',
        ]);

        $viewerRole = Role::firstOrCreate(['name' => 'viewer', 'guard_name' => 'web']);
        $viewerRole->syncPermissions([]);
    }
}
