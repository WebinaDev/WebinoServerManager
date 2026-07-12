<?php

namespace Modules\Users\Http\Controllers;

use App\Events\UserCreated;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'users' => User::query()->with('roles')->orderBy('username')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'min:3', 'max:32', 'regex:/^[a-zA-Z0-9_]+$/', 'unique:users,username'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'username' => $data['username'],
            'email' => $data['email'] ?? null,
            'password' => Hash::make($data['password']),
        ]);
        $user->assignRole($data['role']);

        UserCreated::dispatch('user.created', [
            'user_id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $data['role'],
        ]);

        return response()->json(['user' => $user->load('roles')], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'password' => ['sometimes', 'confirmed', PasswordRule::min(8)],
            'role' => ['sometimes', 'string', 'exists:roles,name'],
        ]);

        if (isset($data['role']) && $user->hasRole('admin') && $data['role'] !== 'admin') {
            $this->guardLastAdmin($user);
        }

        if (isset($data['name'])) {
            $user->name = $data['name'];
        }
        if (array_key_exists('email', $data)) {
            $user->email = $data['email'];
        }
        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }
        $user->save();

        if (isset($data['role'])) {
            $user->syncRoles([$data['role']]);
        }

        return response()->json(['user' => $user->fresh()->load('roles')]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()?->id === $user->id) {
            return response()->json(['message' => __('users.cannot_delete_self')], 422);
        }
        if ($user->hasRole('admin')) {
            $this->guardLastAdmin($user);
        }
        $user->delete();

        return response()->json(['message' => __('users.deleted')]);
    }

    private function guardLastAdmin(User $user): void
    {
        $adminCount = User::role('admin')->count();
        if ($adminCount <= 1 && $user->hasRole('admin')) {
            abort(422, __('users.last_admin'));
        }
    }
}
