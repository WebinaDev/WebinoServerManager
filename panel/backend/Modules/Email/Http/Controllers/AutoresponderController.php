<?php

namespace Modules\Email\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Email\Entities\Autoresponder;

class AutoresponderController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'autoresponders' => Autoresponder::query()->orderBy('address')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'address' => ['required', 'email', 'max:255', 'unique:mail_autoresponders,address'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        $row = Autoresponder::query()->create([
            'address' => strtolower($data['address']),
            'subject' => $data['subject'] ?? 'Out of office',
            'body' => $data['body'],
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/mail/autoresponders', [
            'address' => $row->address,
            'subject' => $row->subject,
            'body' => $row->body,
            'action' => 'set',
        ]);

        $row->update([
            'status' => ($result['ok'] ?? false) ? 'active' : 'error',
            'last_error' => $result['error'] ?? null,
        ]);

        return response()->json(['autoresponder' => $row->fresh()], 201);
    }

    public function destroy(Autoresponder $autoresponder): JsonResponse
    {
        $this->agent->post('/v1/mail/autoresponders', [
            'address' => $autoresponder->address,
            'action' => 'delete',
        ]);
        $autoresponder->delete();

        return response()->json(['message' => __('email.autoresponder_deleted')]);
    }
}
