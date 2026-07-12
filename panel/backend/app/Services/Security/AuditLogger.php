<?php

namespace App\Services\Security;

use Illuminate\Http\Request;
use Modules\Security\Entities\AuditLog;

class AuditLogger
{
    public static function log(Request $request, string $action, ?string $target = null, ?array $meta = null): void
    {
        AuditLog::query()->create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'target' => $target,
            'ip' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'meta' => $meta,
            'created_at' => now(),
        ]);
    }
}
