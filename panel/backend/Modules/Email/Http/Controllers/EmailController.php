<?php

namespace Modules\Email\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Modules\Email\Entities\MailAccount;
use Modules\Email\Entities\MailDomain;
use Modules\Email\Entities\MailForwarder;

class EmailController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function indexDomains(): JsonResponse
    {
        return response()->json([
            'domains' => MailDomain::query()->orderBy('domain')->get(),
        ]);
    }

    public function storeDomain(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253', 'unique:mail_domains,domain'],
        ]);

        $domain = MailDomain::query()->create([
            'domain' => strtolower($data['domain']),
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/mail/domains', [
            'domain' => $domain->domain,
            'action' => 'create',
        ]);

        if (! ($result['ok'] ?? false)) {
            $domain->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('email.domain_failed'), 'domain' => $domain], 422);
        }

        $domain->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['domain' => $domain->fresh(), 'agent' => $result], 201);
    }

    public function destroyDomain(MailDomain $domain): JsonResponse
    {
        $this->agent->post('/v1/mail/domains', [
            'domain' => $domain->domain,
            'action' => 'delete',
        ]);
        $domain->delete();

        return response()->json(['message' => __('email.domain_deleted')]);
    }

    public function indexAccounts(): JsonResponse
    {
        $accounts = MailAccount::query()->orderBy('address')->get();
        $quotaByAddress = [];
        if ($accounts->isNotEmpty()) {
            $addresses = $accounts->pluck('address')->implode(',');
            try {
                $result = $this->agent->get('/v1/mail/quota?addresses='.urlencode($addresses));
                if ($result['ok'] ?? false) {
                    $data = $result['data'] ?? [];
                    if (is_string($data)) {
                        $data = json_decode($data, true) ?? [];
                    }
                    if (is_array($data)) {
                        $quotaByAddress = $data;
                    }
                }
            } catch (\Throwable) {
                // best-effort
            }
        }

        $enriched = $accounts->map(function (MailAccount $account) use ($quotaByAddress) {
            $row = $account->toArray();
            $usage = $quotaByAddress[$account->address] ?? null;
            if (is_array($usage) && ! isset($usage['error'])) {
                $row['quota_usage'] = $usage;
            }

            return $row;
        });

        return response()->json(['accounts' => $enriched]);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $data = $request->validate([
            'address' => ['required', 'email', 'max:255', 'unique:mail_accounts,address'],
            'password' => ['required', 'string', 'min:8'],
            'quota_mb' => ['nullable', 'integer', 'min:1'],
        ]);

        $address = strtolower($data['address']);
        $mailDomain = $this->ensureMailDomain($address);

        $account = MailAccount::query()->create([
            'mail_domain_id' => $mailDomain?->id,
            'address' => $address,
            'password_encrypted' => Crypt::encryptString($data['password']),
            'quota_mb' => $data['quota_mb'] ?? 1024,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/mail/accounts', [
            'address' => $account->address,
            'password' => $data['password'],
            'quota_mb' => $account->quota_mb,
            'action' => 'create',
        ]);

        if (! ($result['ok'] ?? false)) {
            $account->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('email.account_failed'), 'account' => $account], 422);
        }

        $account->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['account' => $account->fresh(), 'agent' => $result], 201);
    }

    public function destroyAccount(MailAccount $account): JsonResponse
    {
        $this->agent->post('/v1/mail/accounts', [
            'address' => $account->address,
            'action' => 'delete',
        ]);
        $account->delete();

        return response()->json(['message' => __('email.account_deleted')]);
    }

    public function updateAccountPassword(Request $request, MailAccount $account): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ]);

        $result = $this->agent->post('/v1/mail/accounts', [
            'address' => $account->address,
            'password' => $data['password'],
            'action' => 'passwd',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('email.password_failed')], 422);
        }

        $account->update([
            'password_encrypted' => Crypt::encryptString($data['password']),
        ]);

        return response()->json(['message' => __('email.password_updated')]);
    }

    public function updateAccountQuota(Request $request, MailAccount $account): JsonResponse
    {
        $data = $request->validate([
            'quota_mb' => ['required', 'integer', 'min:1'],
        ]);

        $result = $this->agent->post('/v1/mail/accounts', [
            'address' => $account->address,
            'quota_mb' => $data['quota_mb'],
            'action' => 'quota',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('email.quota_failed')], 422);
        }

        $account->update(['quota_mb' => $data['quota_mb']]);

        return response()->json([
            'account' => $account->fresh(),
            'message' => __('email.quota_updated'),
        ]);
    }

    public function updateDomainCatchall(Request $request, MailDomain $domain): JsonResponse
    {
        $data = $request->validate([
            'destination' => ['nullable', 'email'],
        ]);

        if (empty($data['destination'])) {
            $this->agent->post('/v1/mail/catchall', [
                'domain' => $domain->domain,
                'action' => 'delete',
            ]);
            $domain->update(['catch_all' => null]);

            return response()->json(['domain' => $domain->fresh()]);
        }

        $result = $this->agent->post('/v1/mail/catchall', [
            'domain' => $domain->domain,
            'destination' => strtolower($data['destination']),
            'action' => 'set',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('email.catchall_failed')], 422);
        }

        $domain->update(['catch_all' => strtolower($data['destination'])]);

        return response()->json(['domain' => $domain->fresh()]);
    }

    public function indexForwarders(): JsonResponse
    {
        return response()->json([
            'forwarders' => MailForwarder::query()->orderBy('source')->get(),
        ]);
    }

    public function storeForwarder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source' => ['required', 'email', 'max:255', 'unique:mail_forwarders,source'],
            'destination' => ['required', 'email', 'max:255'],
        ]);

        $forwarder = MailForwarder::query()->create([
            'source' => strtolower($data['source']),
            'destination' => strtolower($data['destination']),
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/mail/forwarders', [
            'source' => $forwarder->source,
            'destination' => $forwarder->destination,
            'action' => 'create',
        ]);

        if (! ($result['ok'] ?? false)) {
            $forwarder->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('email.forwarder_failed'), 'forwarder' => $forwarder], 422);
        }

        $forwarder->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['forwarder' => $forwarder->fresh(), 'agent' => $result], 201);
    }

    public function destroyForwarder(MailForwarder $forwarder): JsonResponse
    {
        $this->agent->post('/v1/mail/forwarders', [
            'source' => $forwarder->source,
            'action' => 'delete',
        ]);
        $forwarder->delete();

        return response()->json(['message' => __('email.forwarder_deleted')]);
    }

    private function ensureMailDomain(string $address): ?MailDomain
    {
        $parts = explode('@', $address);
        if (count($parts) !== 2) {
            return null;
        }
        $domainName = strtolower($parts[1]);
        $domain = MailDomain::query()->firstOrCreate(
            ['domain' => $domainName],
            ['status' => 'pending'],
        );
        if ($domain->wasRecentlyCreated) {
            $result = $this->agent->post('/v1/mail/domains', [
                'domain' => $domain->domain,
                'action' => 'create',
            ]);
            if ($result['ok'] ?? false) {
                $domain->update(['status' => 'active', 'last_error' => null]);
            } else {
                $domain->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);
            }
        }

        return $domain;
    }
}
