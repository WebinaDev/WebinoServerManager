<?php

namespace Modules\Email\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Email\Entities\MailingList;

class MailingListController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'lists' => MailingList::query()->orderBy('source')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source' => ['required', 'email', 'max:255', 'unique:mailing_lists,source'],
            'destinations' => ['required', 'array', 'min:1'],
            'destinations.*' => ['email'],
        ]);

        $list = MailingList::query()->create([
            'source' => strtolower($data['source']),
            'destinations' => array_map('strtolower', $data['destinations']),
            'status' => 'pending',
        ]);

        $this->syncToAgent($list, 'create');

        return response()->json(['list' => $list->fresh()], 201);
    }

    public function update(Request $request, MailingList $list): JsonResponse
    {
        $data = $request->validate([
            'destinations' => ['required', 'array', 'min:1'],
            'destinations.*' => ['email'],
            'status' => ['nullable', 'in:active,disabled'],
        ]);

        $list->update([
            'destinations' => array_map('strtolower', $data['destinations']),
            'status' => $data['status'] ?? $list->status,
        ]);

        if ($list->status === 'active') {
            $this->syncToAgent($list);
        } else {
            $this->agent->post('/v1/mail/lists', [
                'source' => $list->source,
                'action' => 'delete',
            ]);
        }

        return response()->json(['list' => $list->fresh(), 'message' => __('email.list_updated')]);
    }

    public function addMember(Request $request, MailingList $list): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        $email = strtolower($data['email']);
        $destinations = $list->destinations ?? [];
        if (! in_array($email, $destinations, true)) {
            $destinations[] = $email;
            $list->update(['destinations' => $destinations]);
            $this->syncToAgent($list);
        }

        return response()->json(['list' => $list->fresh(), 'message' => __('email.member_added')]);
    }

    public function removeMember(Request $request, MailingList $list): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        $email = strtolower($data['email']);
        $destinations = array_values(array_filter(
            $list->destinations ?? [],
            fn (string $item): bool => $item !== $email,
        ));

        if ($destinations === []) {
            return response()->json(['message' => __('email.list_requires_member')], 422);
        }

        $list->update(['destinations' => $destinations]);
        $this->syncToAgent($list);

        return response()->json(['list' => $list->fresh(), 'message' => __('email.member_removed')]);
    }

    public function destroy(MailingList $list): JsonResponse
    {
        $this->agent->post('/v1/mail/lists', [
            'source' => $list->source,
            'action' => 'delete',
        ]);
        $list->delete();

        return response()->json(['message' => __('email.list_deleted')]);
    }

    private function syncToAgent(MailingList $list, string $action = 'update'): void
    {
        $this->agent->post('/v1/mail/lists', [
            'source' => $list->source,
            'destinations' => $list->destinations,
            'action' => $action,
        ]);

        $list->update(['status' => 'active', 'last_error' => null]);
    }
}
