<?php

namespace Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Mail\PanelMailConfigurator;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

class PasswordResetController extends Controller
{
    public function mailStatus(): JsonResponse
    {
        return response()->json([
            'data' => [
                'configured' => PanelMailConfigurator::isConfigured(),
            ],
        ]);
    }

    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:32'],
        ]);

        $user = User::query()->where('username', $data['username'])->first();

        if ($user && $user->email && PanelMailConfigurator::isConfigured()) {
            PanelMailConfigurator::applyFromSettings();
            Password::sendResetLink(['email' => $user->email]);
        }

        return response()->json([
            'message' => __('auth.reset_link_sent'),
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json(['message' => __('auth.password_reset_success')]);
    }
}
