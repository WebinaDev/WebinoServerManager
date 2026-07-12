<?php

namespace App\Http\Middleware;

use App\Models\PanelSetting;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class ThrottleApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $limit = (int) PanelSetting::get('api_rate_limit_per_minute', 120);
        $limit = max(1, $limit);

        $token = $user?->currentAccessToken();
        $key = $token !== null
            ? 'api-token:'.$token->id
            : 'api-user:'.($user?->id ?? 'guest').'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, $limit)) {
            $retryAfter = RateLimiter::availableIn($key);

            return response()->json([
                'message' => __('tokens.rate_limited'),
            ], 429)->withHeaders([
                'Retry-After' => (string) $retryAfter,
                'X-RateLimit-Limit' => (string) $limit,
                'X-RateLimit-Remaining' => '0',
            ]);
        }

        RateLimiter::hit($key, 60);

        $response = $next($request);
        $remaining = max(0, $limit - RateLimiter::attempts($key));

        if ($response instanceof Response) {
            $response->headers->set('X-RateLimit-Limit', (string) $limit);
            $response->headers->set('X-RateLimit-Remaining', (string) $remaining);
        }

        return $response;
    }
}
