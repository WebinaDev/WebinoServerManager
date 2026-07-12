<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ResetPasswordCommand extends Command
{
    protected $signature = 'panel:reset-password {username} {--password=}';

    protected $description = 'Reset a panel user password (offline admin recovery)';

    public function handle(): int
    {
        $user = User::query()->where('username', $this->argument('username'))->first();
        if (! $user) {
            $this->error('User not found.');

            return self::FAILURE;
        }

        $password = $this->option('password') ?: Str::password(16);
        $user->update(['password' => Hash::make($password)]);
        $this->info("Password reset for {$user->username}.");
        if (! $this->option('password')) {
            $this->line("New password: {$password}");
        }

        return self::SUCCESS;
    }
}
