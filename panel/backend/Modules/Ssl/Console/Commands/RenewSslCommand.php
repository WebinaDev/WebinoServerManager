<?php

namespace Modules\Ssl\Console\Commands;

use App\Models\User;
use App\Services\Agent\AgentClient;
use App\Services\Mail\PanelMailConfigurator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Modules\Ssl\Entities\SslCertificate;

class RenewSslCommand extends Command
{
    protected $signature = 'panel:renew-ssl';

    protected $description = 'Renew SSL certificates with auto_renew enabled';

    public function handle(AgentClient $agent): int
    {
        $certs = SslCertificate::query()
            ->where('auto_renew', true)
            ->where('status', 'active')
            ->get();

        foreach ($certs as $cert) {
            $result = $agent->post('/v1/ssl/certificates', [
                'domain' => $cert->domain,
                'action' => 'renew',
            ]);

            if ($result['ok'] ?? false) {
                $data = $result['data'] ?? [];
                if (is_string($data)) {
                    $data = json_decode($data, true) ?? [];
                }
                $cert->update([
                    'expires_at' => $data['expires_at'] ?? $cert->expires_at,
                    'last_renewed_at' => now(),
                    'last_error' => null,
                ]);
                $this->line("Renewed: {$cert->domain}");
            } else {
                $cert->update(['last_error' => $result['error'] ?? 'renew failed']);
                $this->warn("Failed: {$cert->domain}");
            }
        }

        return self::SUCCESS;
    }
}
