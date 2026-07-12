<?php

namespace App\Http\Middleware;

use App\Services\Security\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogAuditAction
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($request->user() && in_array($request->method(), ['POST', 'PATCH', 'PUT', 'DELETE'], true)) {
            $path = $request->path();
            if (! str_starts_with($path, 'api/v1/auth/login')) {
                AuditLogger::log($request, $request->method().' '.$path);
            }
        }

        return $response;
    }
}
