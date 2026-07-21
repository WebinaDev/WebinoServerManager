<?php

namespace Modules\Users\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    /** @var list<string> */
    private const PROTECTED_ROLES = ['admin'];

    public function index(): JsonResponse
    {
        return response()->json([
            'roles' => Role::query()->with('permissions')->orderBy('name')->get(),
            'permissions' => Permission::query()->orderBy('name')->pluck('name'),
        ]);
    }

    public function permissions(): JsonResponse
    {
        return response()->json([
            'permissions' => Permission::query()->orderBy('name')->pluck('name'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:64', 'regex:/^[a-z][a-z0-9_-]*$/', 'unique:roles,name'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        if (in_array(strtolower($data['name']), self::PROTECTED_ROLES, true)) {
            return response()->json(['message' => __('users.role_protected')], 422);
        }

        $role = Role::query()->create([
            'name' => $data['name'],
            'guard_name' => 'web',
        ]);
        $role->syncPermissions($data['permissions'] ?? []);

        return response()->json([
            'role' => $role->load('permissions'),
            'message' => __('users.role_saved'),
        ], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            return response()->json(['message' => __('users.role_protected')], 422);
        }

        $data = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:64',
                'regex:/^[a-z][a-z0-9_-]*$/',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        if (isset($data['name'])) {
            if (in_array(strtolower($data['name']), self::PROTECTED_ROLES, true)) {
                return response()->json(['message' => __('users.role_protected')], 422);
            }
            $role->name = $data['name'];
            $role->save();
        }

        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($data['permissions'] ?? []);
        }

        return response()->json([
            'role' => $role->fresh()->load('permissions'),
            'message' => __('users.role_saved'),
        ]);
    }

    public function destroy(Role $role): JsonResponse
    {
        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            return response()->json(['message' => __('users.role_protected')], 422);
        }

        if ($role->users()->exists()) {
            return response()->json(['message' => __('users.role_in_use')], 422);
        }

        $role->delete();

        return response()->json(['message' => __('users.role_deleted')]);
    }
}
