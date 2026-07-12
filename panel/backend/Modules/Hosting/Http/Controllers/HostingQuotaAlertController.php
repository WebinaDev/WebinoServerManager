<?php

namespace Modules\Hosting\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Hosting\Entities\HostingAccount;
use Modules\Hosting\Entities\HostingQuotaAlert;
use Modules\Hosting\Services\HostingQuota;

class HostingQuotaAlertController extends Controller
{
    private const RESOURCES = [
        'disk', 'inodes', 'domains', 'subdomains', 'databases',
        'mailboxes', 'ftp', 'cron', 'apps',
    ];

    public function __construct(private readonly HostingQuota $quota) {}

    public function index(HostingAccount $account): JsonResponse
    {
        return response()->json([
            'alerts' => HostingQuotaAlert::query()
                ->where('hosting_account_id', $account->id)
                ->orderBy('resource')
                ->get(),
            'usage' => $this->quota->usageSummary($account),
        ]);
    }

    public function store(Request $request, HostingAccount $account): JsonResponse
    {
        $data = $request->validate([
            'resource' => ['required', 'string', Rule::in(self::RESOURCES)],
            'threshold_percent' => ['nullable', 'integer', 'min:1', 'max:100'],
            'enabled' => ['boolean'],
            'escalation_minutes' => ['nullable', 'integer', 'min:5', 'max:10080'],
            'escalation_channel' => ['nullable', 'string', Rule::in(['email', 'telegram', 'slack', 'webhook', 'all'])],
        ]);

        $alert = HostingQuotaAlert::query()->updateOrCreate(
            [
                'hosting_account_id' => $account->id,
                'resource' => $data['resource'],
            ],
            [
                'threshold_percent' => $data['threshold_percent'] ?? 80,
                'enabled' => $data['enabled'] ?? true,
                'escalation_minutes' => $data['escalation_minutes'] ?? 60,
                'escalation_channel' => $data['escalation_channel'] ?? 'email',
            ],
        );

        return response()->json([
            'alert' => $alert->fresh(),
            'message' => __('hosting.quota_alert_saved'),
        ], 201);
    }

    public function update(Request $request, HostingAccount $account, HostingQuotaAlert $alert): JsonResponse
    {
        if ($alert->hosting_account_id !== $account->id) {
            abort(404);
        }

        $data = $request->validate([
            'threshold_percent' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'enabled' => ['sometimes', 'boolean'],
            'escalation_minutes' => ['sometimes', 'integer', 'min:5', 'max:10080'],
            'escalation_channel' => ['sometimes', 'string', Rule::in(['email', 'telegram', 'slack', 'webhook', 'all'])],
        ]);

        $alert->update($data);

        return response()->json([
            'alert' => $alert->fresh(),
            'message' => __('hosting.quota_alert_saved'),
        ]);
    }

    public function destroy(HostingAccount $account, HostingQuotaAlert $alert): JsonResponse
    {
        if ($alert->hosting_account_id !== $account->id) {
            abort(404);
        }

        $alert->delete();

        return response()->json(['message' => __('hosting.quota_alert_deleted')]);
    }
}
