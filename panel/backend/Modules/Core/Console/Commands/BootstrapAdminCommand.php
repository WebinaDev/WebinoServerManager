<?php

namespace Modules\Core\Console\Commands;

use App\Models\PanelSetting;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class BootstrapAdminCommand extends Command
{
    protected $signature = 'panel:bootstrap-admin
        {--username=admin : Admin username}
        {--password= : Plain password (generated if empty)}
        {--name=Administrator : Display name}
        {--email= : Optional email}
        {--force : Recreate password if admin already exists}';

    protected $description = 'Create the initial panel admin (aaPanel-style first-run credentials)';

    public function handle(): int
    {
        $username = (string) $this->option('username');
        $name = (string) $this->option('name');
        $email = $this->option('email') ? (string) $this->option('email') : null;
        $password = (string) ($this->option('password') ?: '');
        $generated = false;

        if ($password === '') {
            $password = Str::password(16, symbols: false);
            $generated = true;
        }

        if (strlen($password) < 8) {
            $this->error('Password must be at least 8 characters.');

            return self::FAILURE;
        }

        $adminRole = Role::query()->firstOrCreate(
            ['name' => 'admin', 'guard_name' => 'web'],
        );

        $existing = User::query()->where('username', $username)->first();
        if ($existing !== null) {
            if (! $this->option('force') && $existing->hasRole('admin')) {
                $this->warn("Admin user '{$username}' already exists — leaving password unchanged.");
                $this->line('username='.$username);
                $this->line('created=0');

                return self::SUCCESS;
            }
            $existing->password = Hash::make($password);
            if ($name !== '') {
                $existing->name = $name;
            }
            if ($email !== null) {
                $existing->email = $email;
            }
            $existing->save();
            $existing->assignRole($adminRole);
            $user = $existing;
            $this->info("Updated admin '{$username}'.");
        } else {
            $user = User::query()->create([
                'name' => $name !== '' ? $name : 'Administrator',
                'username' => $username,
                'email' => $email,
                'password' => Hash::make($password),
            ]);
            $user->assignRole($adminRole);
            $this->info("Created admin '{$username}'.");
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // Do NOT mark setup_completed — hosting stack wizard runs after login.
        PanelSetting::set('setup_completed', false);
        PanelSetting::set('panel_name', PanelSetting::get('panel_name', 'WebinoServer'));
        PanelSetting::set('default_locale', PanelSetting::get('default_locale', 'fa'));

        $this->line('username='.$user->username);
        $this->line('password='.$password);
        $this->line('generated='.($generated ? '1' : '0'));
        $this->line('created=1');

        return self::SUCCESS;
    }
}
