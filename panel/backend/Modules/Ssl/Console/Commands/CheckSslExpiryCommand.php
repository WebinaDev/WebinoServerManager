<?php

namespace Modules\Ssl\Console\Commands;

use App\Events\SslExpiring;
use App\Models\User;
use App\Services\Mail\PanelMailConfigurator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Modules\Ssl\Entities\SslCertificate;

class CheckSslExpiryCommand extends Command
{
    protected $signature = 'panel:check-ssl-expiry';

    protected $description = 'Alert admins about SSL certificates nearing expiry';

    public function handle(): int
    {
        $certs = SslCertificate::query()
            ->where('status', 'active')
            ->whereNotNull('expires_at')
            ->get();

        foreach ($certs as $cert) {
            $daysLeft = now()->diffInDays($cert->expires_at, false);
            if ($daysLeft > $cert->alert_days) {
                continue;
            }
            if ($cert->last_alert_at && $cert->last_alert_at->gt(now()->subDay())) {
                continue;
            }

            if (PanelMailConfigurator::isConfigured()) {
                PanelMailConfigurator::applyFromSettings();
                $admin = User::query()->role('admin')->whereNotNull('email')->first();
                if ($admin) {
                    Mail::raw(__('ssl.expiry_alert_body', [
                        'domain' => $cert->domain,
                        'days' => max(0, $daysLeft),
                        'expires' => $cert->expires_at?->toDateString(),
                    ]), function ($message) use ($admin, $cert): void {
                        $message->to($admin->email)
                            ->subject(__('ssl.expiry_alert_subject', ['domain' => $cert->domain]));
                    });
                }
            }

            $cert->update(['last_alert_at' => now()]);

            SslExpiring::dispatch('ssl.expiring', [
                'domain' => $cert->domain,
                'days_left' => max(0, $daysLeft),
                'expires_at' => $cert->expires_at?->toIso8601String(),
            ]);

            $this->warn("Expiry alert: {$cert->domain} ({$daysLeft} days)");
        }

        return self::SUCCESS;
    }
}
