<?php

namespace Modules\Security\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Security\Entities\AuditLog;
use Modules\Security\Entities\LoginHistory;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $logs = AuditLog::query()
            ->with('user:id,name,username')
            ->orderByDesc('created_at')
            ->limit((int) $request->query('limit', 100))
            ->get();

        return response()->json(['logs' => $logs]);
    }

    public function loginHistory(Request $request): JsonResponse
    {
        $history = LoginHistory::query()
            ->with('user:id,name,username')
            ->orderByDesc('created_at')
            ->limit((int) $request->query('limit', 100))
            ->get();

        return response()->json(['history' => $history]);
    }
}
