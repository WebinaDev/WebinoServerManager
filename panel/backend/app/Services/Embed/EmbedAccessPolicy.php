<?php

namespace App\Services\Embed;

use App\Models\User;
use Modules\Databases\Entities\HostingDatabase;
use Modules\Email\Entities\MailAccount;
use Modules\Hosting\Entities\HostingAccount;

class EmbedAccessPolicy
{
    public function canAccessDatabase(User $user, HostingDatabase $database): bool
    {
        if ($user->hasAnyRole(['admin', 'operator'])) {
            return true;
        }

        if ($database->hosting_account_id === null) {
            return false;
        }

        return HostingAccount::query()
            ->where('id', $database->hosting_account_id)
            ->where('user_id', $user->id)
            ->exists();
    }

    public function canAccessMailAccount(User $user, MailAccount $account): bool
    {
        if ($user->hasAnyRole(['admin', 'operator'])) {
            return true;
        }

        $parts = explode('@', $account->address, 2);
        if (count($parts) !== 2) {
            return false;
        }

        $domain = strtolower($parts[1]);

        return HostingAccount::query()
            ->where('user_id', $user->id)
            ->where(function ($query) use ($domain): void {
                $query->where('primary_domain', $domain)
                    ->orWhere('primary_domain', 'like', '%.'.$domain);
            })
            ->exists();
    }
}
