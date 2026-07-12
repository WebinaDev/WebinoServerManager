<?php

namespace App\Http\Middleware;

use App\Models\PanelSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireTwoFactor
{
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->environment('testing')) {
            return $next($request);
        }

        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        $enforceRoles = PanelSetting::get('enforce_2fa_roles', 'admin,operator');
        $roles = array_map('trim', explode(',', (string) $enforceRoles));
        $mustEnforce = $user->hasAnyRole($roles);

        if ($mustEnforce && (! $user->two_factor_secret || ! $user->two_factor_confirmed_at)) {
            $allowed = [
                'v1/auth/2fa/status',
                'v1/auth/2fa/enable',
                'v1/auth/2fa/confirm',
                'v1/auth/2fa/verify',
                'v1/auth/logout',
                'v1/auth/check',
                'v1/auth/user',
                'api/v1/auth/2fa/status',
                'api/v1/auth/2fa/enable',
                'api/v1/auth/2fa/confirm',
                'api/v1/auth/2fa/verify',
                'api/v1/auth/logout',
                'api/v1/auth/check',
                'api/v1/auth/user',
            ];
            if (! in_array($request->path(), $allowed, true)) {
                return response()->json([
                    'two_factor_setup_required' => true,
                    'message' => __('auth.two_factor_setup_required'),
                ], 403);
            }
        }

        return $next($request);
    }
}
