<?php

namespace Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TerminalController extends Controller
{
    public function ticket(Request $request): JsonResponse
    {
        $user = $request->user();
        $secret = (string) config('webino.agent.token', '');

        if ($secret === '') {
            return response()->json(['message' => __('terminal.token_not_configured')], 503);
        }

        $payload = json_encode([
            'exp' => now()->addSeconds(30)->timestamp,
            'uid' => $user->id,
        ], JSON_THROW_ON_ERROR);

        $payloadB64 = base64_encode($payload);
        $sig = hash_hmac('sha256', $payloadB64, $secret);
        $ticket = $payloadB64.'.'.$sig;

        return response()->json([
            'data' => [
                'ticket' => $ticket,
                'ws_path' => '/api/terminal/ws',
                'expires_in' => 30,
            ],
        ]);
    }
}
