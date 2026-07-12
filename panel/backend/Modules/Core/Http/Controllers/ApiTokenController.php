<?php

namespace Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class ApiTokenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $tokens = $user->tokens()
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (PersonalAccessToken $token) => [
                'id' => $token->id,
                'name' => $token->name,
                'abilities' => $token->abilities ?? [],
                'last_used_at' => $token->last_used_at,
                'expires_at' => $token->expires_at,
                'created_at' => $token->created_at,
            ]);

        return response()->json([
            'tokens' => $tokens,
            'available_abilities' => $this->allowedAbilitiesFor($request, $user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['nullable', 'array'],
            'abilities.*' => ['string', 'max:64'],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        $allowed = $this->allowedAbilitiesFor($request, $user);
        $requested = $data['abilities'] ?? [];
        foreach ($requested as $ability) {
            if ($ability !== 'read' && ! in_array($ability, $allowed, true)) {
                return response()->json([
                    'message' => __('tokens.ability_forbidden', ['ability' => $ability]),
                ], 422);
            }
        }

        $abilities = array_values(array_unique(array_merge(['read'], $requested)));

        $accessToken = $user->createToken(
            $data['name'],
            $abilities,
            $data['expires_at'] ?? null
        );

        return response()->json([
            'token' => $accessToken->plainTextToken,
            'token_meta' => [
                'id' => $accessToken->accessToken->id,
                'name' => $accessToken->accessToken->name,
                'abilities' => $accessToken->accessToken->abilities,
                'expires_at' => $accessToken->accessToken->expires_at,
            ],
            'message' => __('tokens.created'),
        ], 201);
    }

    public function destroy(Request $request, int $token): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $record = $user->tokens()->where('id', $token)->first();
        if ($record === null) {
            return response()->json(['message' => __('tokens.not_found')], 404);
        }

        $record->delete();

        return response()->json(['message' => __('tokens.revoked')]);
    }

    /**
     * @return list<string>
     */
    private function allowedAbilitiesFor(Request $request, User $user): array
    {
        $userPerms = $user->getAllPermissions()->pluck('name')->all();
        $token = $user->currentAccessToken();

        if ($token === null || in_array('*', $token->abilities ?? [], true)) {
            return $userPerms;
        }

        $tokenAbilities = array_values(array_filter(
            $token->abilities ?? [],
            fn (string $a) => $a !== 'read' && $a !== '*',
        ));

        return array_values(array_intersect($tokenAbilities, $userPerms));
    }
}
