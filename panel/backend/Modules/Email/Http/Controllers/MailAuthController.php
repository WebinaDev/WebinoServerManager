<?php

namespace Modules\Email\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Dns\Entities\DnsRecord;
use Modules\Dns\Entities\DnsZone;
use Modules\Email\Entities\MailDomain;

class MailAuthController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function generate(Request $request, MailDomain $domain): JsonResponse
    {
        $data = $request->validate([
            'server_ip' => ['nullable', 'ip'],
            'dmarc_email' => ['nullable', 'email'],
        ]);

        $dkim = $this->agent->post('/v1/mail/dkim', [
            'domain' => $domain->domain,
            'action' => 'generate',
            'selector' => 'default',
        ]);

        if (! ($dkim['ok'] ?? false)) {
            return response()->json(['message' => $dkim['error'] ?? 'dkim failed'], 422);
        }

        $dkimData = $this->payload($dkim);
        $domain->update([
            'dkim_selector' => $dkimData['selector'] ?? 'default',
            'dkim_public_key' => $dkimData['public_key'] ?? null,
        ]);

        $zone = DnsZone::query()->firstOrCreate(
            ['domain' => $domain->domain],
            ['status' => 'pending'],
        );

        $ip = $data['server_ip'] ?? request()->server('SERVER_ADDR', '127.0.0.1');
        $spf = "v=spf1 mx a ip4:{$ip} ~all";
        $dmarcEmail = $data['dmarc_email'] ?? 'dmarc@'.$domain->domain;
        $dmarc = "v=DMARC1; p=quarantine; rua=mailto:{$dmarcEmail}";
        $dkimName = ($dkimData['selector'] ?? 'default').'._domainkey';
        $dkimTxt = $dkimData['txt_record'] ?? '';

        $records = [
            ['type' => 'TXT', 'name' => '@', 'content' => $spf],
            ['type' => 'TXT', 'name' => '_dmarc', 'content' => $dmarc],
            ['type' => 'TXT', 'name' => $dkimName, 'content' => $dkimTxt],
        ];

        $created = [];
        foreach ($records as $rec) {
            if ($rec['content'] === '') {
                continue;
            }
            $record = DnsRecord::query()->create([
                'zone_id' => $zone->id,
                'type' => $rec['type'],
                'name' => $rec['name'],
                'content' => $rec['content'],
                'ttl' => 3600,
                'status' => 'pending',
            ]);
            $result = $this->agent->post('/v1/dns/records', [
                'domain' => $zone->domain,
                'type' => $record->type,
                'name' => $record->name,
                'content' => $record->content,
                'ttl' => $record->ttl,
                'action' => 'create',
            ]);
            $record->update([
                'status' => ($result['ok'] ?? false) ? 'active' : 'error',
                'last_error' => $result['error'] ?? null,
            ]);
            $created[] = $record;
        }

        return response()->json([
            'domain' => $domain->fresh(),
            'records' => $created,
            'dkim' => $dkimData,
        ]);
    }

    public function validateDns(MailDomain $domain): JsonResponse
    {
        $checks = [];
        $spf = dns_get_record($domain->domain, DNS_TXT);
        $checks['spf'] = $this->txtContains($spf, 'v=spf1');

        $dmarcHost = '_dmarc.'.$domain->domain;
        $dmarc = dns_get_record($dmarcHost, DNS_TXT);
        $checks['dmarc'] = $this->txtContains($dmarc, 'v=DMARC1');

        $selector = $domain->dkim_selector ?? 'default';
        $dkimHost = $selector.'._domainkey.'.$domain->domain;
        $dkim = dns_get_record($dkimHost, DNS_TXT);
        $checks['dkim'] = $this->txtContains($dkim, 'v=DKIM1');

        return response()->json(['domain' => $domain->domain, 'checks' => $checks]);
    }

    /**
     * @param  array<int, array<string, mixed>>|false  $records
     */
    private function txtContains(array|false $records, string $needle): bool
    {
        if (! is_array($records)) {
            return false;
        }
        foreach ($records as $rec) {
            $txt = $rec['txt'] ?? '';
            if (str_contains($txt, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function payload(array $result): array
    {
        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($data) ? $data : [];
    }
}
