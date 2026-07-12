<?php

namespace Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Modules\Security\Entities\LoginHistory;
use PragmaRX\Google2FA\Google2FA;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'otp' => ['nullable', 'string'],
            'recovery_code' => ['nullable', 'string'],
        ]);

        $throttleKey = strtolower($data['username']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'message' => __('auth.throttle', ['seconds' => $seconds]),
            ], 429);
        }

        /** @var User|null $user */
        $user = User::query()->where('username', $data['username'])->first();
        $success = false;

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($throttleKey, 60);
            LoginHistory::query()->create([
                'user_id' => $user?->id,
                'username' => $data['username'],
                'ip' => $request->ip(),
                'user_agent' => (string) $request->userAgent(),
                'success' => false,
                'created_at' => now(),
            ]);
            throw ValidationException::withMessages([
                'username' => [__('auth.failed')],
            ]);
        }

        if ($user->two_factor_secret && $user->two_factor_confirmed_at) {
            $verified = false;
            $otp = $data['otp'] ?? '';
            $recovery = $data['recovery_code'] ?? '';

            if ($recovery !== '' && $user->two_factor_recovery_codes) {
                $codes = json_decode(decrypt($user->two_factor_recovery_codes), true) ?? [];
                if (in_array($recovery, $codes, true)) {
                    $verified = true;
                    $codes = array_values(array_filter($codes, fn ($c) => $c !== $recovery));
                    $user->two_factor_recovery_codes = encrypt(json_encode($codes));
                    $user->save();
                }
            } elseif ($otp !== '') {
                $google2fa = new Google2FA;
                $verified = $google2fa->verifyKey(decrypt($user->two_factor_secret), $otp);
            }

            if (! $verified) {
                RateLimiter::hit($throttleKey, 60);
                LoginHistory::query()->create([
                    'user_id' => $user->id,
                    'username' => $data['username'],
                    'ip' => $request->ip(),
                    'user_agent' => (string) $request->userAgent(),
                    'success' => false,
                    'created_at' => now(),
                ]);

                return response()->json([
                    'two_factor_required' => true,
                    'message' => __('auth.two_factor_required'),
                ], 422);
            }
        }

        RateLimiter::clear($throttleKey);
        $success = true;
        LoginHistory::query()->create([
            'user_id' => $user->id,
            'username' => $data['username'],
            'ip' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'success' => $success,
            'created_at' => now(),
        ]);

        $accessToken = $user->createToken('panel', ['*']);
        $token = $accessToken->plainTextToken;

        return $this->attachAuthCookie(response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->load('roles', 'permissions'),
        ]), $token);
    }

    public function session(Request $request): JsonResponse
    {
        return $this->login($request);
    }

    public function check(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['authenticated' => false], 401);
        }

        return response()->json([
            'authenticated' => true,
            'user' => $user->load('roles', 'permissions'),
        ]);
    }

    public function gate(Request $request): JsonResponse
    {
        $authenticated = false;
        if ($request->bearerToken()) {
            $authenticated = \Laravel\Sanctum\PersonalAccessToken::findToken($request->bearerToken()) !== null;
        }
        if (! $authenticated) {
            $authenticated = $this->resolveUserFromCookie($request) !== null;
        }

        return response()->json([
            'data' => [
                'needs_setup' => needs_setup(),
                'authenticated' => $authenticated,
            ],
        ]);
    }

    private function resolveUserFromCookie(Request $request): ?User
    {
        $token = $request->cookie(config('auth.cookie_name', 'webino_auth_token'));
        if (! $token) {
            return null;
        }

        $accessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($token);

        return $accessToken?->tokenable instanceof User ? $accessToken->tokenable : null;
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return $this->clearAuthCookie(response()->json(['message' => __('auth.logged_out')]));
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json($request->user()->load('roles', 'permissions'));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'timezone' => ['sometimes', 'string', 'max:64'],
            'locale' => ['sometimes', 'nullable', 'string', 'in:en,fa,ar'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $user->fill($data);
        $user->save();

        return response()->json($user->load('roles', 'permissions'));
    }

    private function attachAuthCookie(JsonResponse $response, string $token): JsonResponse
    {
        return $response->cookie(
            config('auth.cookie_name', 'webino_auth_token'),
            $token,
            config('auth.cookie_max_minutes', 60 * 24 * 7),
            '/',
            null,
            config('auth.cookie_secure'),
            true,
            false,
            'lax'
        );
    }

    private function clearAuthCookie(JsonResponse $response): JsonResponse
    {
        return $response->cookie(
            config('auth.cookie_name', 'webino_auth_token'),
            '',
            -1,
            '/',
            null,
            config('auth.cookie_secure'),
            true,
            false,
            'lax'
        );
    }
}
