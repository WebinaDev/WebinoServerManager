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

        $result = $this->agent->post('/v1/mail/lists', [
            'source' => $list->source,
            'destinations' => $list->destinations,
            'action' => 'create',
        ]);

        $list->update([
            'status' => ($result['ok'] ?? false) ? 'active' : 'error',
            'last_error' => $result['error'] ?? null,
        ]);

        return response()->json(['list' => $list->fresh()], 201);
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
}
