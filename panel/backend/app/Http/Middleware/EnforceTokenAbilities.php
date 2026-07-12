<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceTokenAbilities
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user === null) {
            return $next($request);
        }

        $token = $user->currentAccessToken();
        if ($token === null) {
            return $next($request);
        }

        $abilities = $token->abilities ?? [];
        if (in_array('*', $abilities, true)) {
            return $next($request);
        }

        $route = $request->route();
        if ($route === null) {
            return $next($request);
        }

        $required = null;
        foreach ($route->gatherMiddleware() as $middleware) {
            if (is_string($middleware) && str_starts_with($middleware, 'permission:')) {
                $required = substr($middleware, strlen('permission:'));
                break;
            }
        }

        if ($required === null) {
            $required = $this->requiredAbilityForPath($request->path());
        }

        if ($required === null) {
            return $next($request);
        }

        if (! $user->tokenCan($required)) {
            return response()->json(['message' => __('tokens.insufficient_ability')], 403);
        }

        return $next($request);
    }

    private function requiredAbilityForPath(string $path): ?string
    {
        $path = trim($path, '/');
        $allowlist = config('token_abilities.allowlist', []);
        foreach ($allowlist as $allowed) {
            $allowed = trim($allowed, '/');
            if ($path === $allowed || str_starts_with($path, $allowed.'/')) {
                return null;
            }
        }

        $prefixes = config('token_abilities.prefixes', []);
        $matches = [];
        foreach ($prefixes as $prefix => $ability) {
            $prefix = trim($prefix, '/');
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                $matches[$prefix] = $ability;
            }
        }

        if ($matches === []) {
            return 'system.manage';
        }

        uksort($matches, fn (string $a, string $b) => strlen($b) <=> strlen($a));

        return reset($matches) ?: null;
    }
}
