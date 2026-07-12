<?php

namespace Modules\Support\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Support\Entities\SupportTicket;
use Modules\Support\Entities\SupportTicketReply;

class SupportController extends Controller
{
    public function index(): JsonResponse
    {
        $tickets = SupportTicket::query()
            ->withCount('replies')
            ->orderByDesc('id')
            ->get();

        return response()->json(['tickets' => $tickets]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
        ]);

        $ticket = SupportTicket::query()->create([
            'subject' => $data['subject'],
            'body' => $data['body'],
            'priority' => $data['priority'] ?? 'normal',
            'status' => 'open',
            'user_id' => $request->user()?->id,
        ]);

        return response()->json(['ticket' => $ticket], 201);
    }

    public function show(SupportTicket $ticket): JsonResponse
    {
        $ticket->load(['replies' => fn ($q) => $q->orderBy('id')]);

        return response()->json(['ticket' => $ticket]);
    }

    public function reply(Request $request, SupportTicket $ticket): JsonResponse
    {
        if ($ticket->status === 'closed') {
            return response()->json(['message' => __('support.ticket_closed')], 422);
        }

        $data = $request->validate([
            'body' => ['required', 'string'],
        ]);

        $author = $request->user()?->name ?? $request->user()?->username ?? 'admin';

        $reply = SupportTicketReply::query()->create([
            'support_ticket_id' => $ticket->id,
            'author' => $author,
            'body' => $data['body'],
        ]);

        return response()->json(['reply' => $reply], 201);
    }

    public function close(SupportTicket $ticket): JsonResponse
    {
        $ticket->update(['status' => 'closed']);

        return response()->json(['ticket' => $ticket->fresh(), 'message' => __('support.closed')]);
    }
}
