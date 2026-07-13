<?php

namespace Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PanelSetting;
use App\Models\User;
use App\Services\Panel\PanelEnvPatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class SetupController extends Controller
{
    public function __construct(private readonly PanelEnvPatcher $envPatcher) {}

    public function status(): JsonResponse
    {
        $needsSetup = needs_setup();

        return response()->json([
            'data' => [
                'needs_setup' => $needsSetup,
                'setup_completed' => ! $needsSetup,
            ],
        ]);
    }

    public function submit(Request $request): JsonResponse
    {
        if (setup_completed()) {
            return response()->json([
                'message' => __('setup.already_completed'),
            ], 409);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'min:3', 'max:32', 'regex:/^[a-zA-Z0-9_]+$/', 'unique:users,username'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'default_locale' => ['required', 'in:fa,en'],
            'panel_name' => ['required', 'string', 'max:255'],
            'hostname' => ['nullable', 'string', 'max:255'],
            'smtp_host' => ['nullable', 'string', 'max:255'],
            'smtp_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'smtp_username' => ['nullable', 'string', 'max:255'],
            'smtp_password' => ['nullable', 'string', 'max:255'],
            'smtp_encryption' => ['nullable', 'string', 'in:tls,ssl,'],
            'smtp_from_address' => ['nullable', 'email', 'max:255'],
            'smtp_from_name' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($data): void {
            $adminRole = Role::query()->firstOrCreate(
                ['name' => 'admin', 'guard_name' => 'web'],
            );

            $user = User::query()->create([
                'name' => $data['name'],
                'username' => $data['username'],
                'email' => $data['email'] ?? null,
                'password' => Hash::make($data['password']),
            ]);

            $user->assignRole($adminRole);

            PanelSetting::set('default_locale', $data['default_locale']);
            PanelSetting::set('panel_name', $data['panel_name']);

            if (! empty($data['hostname'])) {
                PanelSetting::set('hostname', $data['hostname']);
            }

            if (! empty($data['smtp_host'])) {
                PanelSetting::set('smtp_host', $data['smtp_host']);
                PanelSetting::set('smtp_port', $data['smtp_port'] ?? 587);
                PanelSetting::set('smtp_username', $data['smtp_username'] ?? '');
                if (! empty($data['smtp_password'])) {
                    PanelSetting::set('smtp_password', $data['smtp_password']);
                }
                PanelSetting::set('smtp_encryption', $data['smtp_encryption'] ?? 'tls');
                if (! empty($data['smtp_from_address'])) {
                    PanelSetting::set('smtp_from_address', $data['smtp_from_address']);
                }
                if (! empty($data['smtp_from_name'])) {
                    PanelSetting::set('smtp_from_name', $data['smtp_from_name']);
                }
            }

            PanelSetting::set('setup_completed', true);
        });

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        $port = (int) config('app.panel_http_port', env('PANEL_HTTP_PORT', 2090));
        $host = ! empty($data['hostname'])
            ? (string) $data['hostname']
            : $request->getHost();
        if ($host !== '' && $host !== 'localhost' && $host !== '127.0.0.1') {
            $this->envPatcher->applyHostname($host, $port, $request->isSecure());
        }

        return response()->json([
            'data' => [
                'needs_setup' => false,
                'setup_completed' => true,
                'message' => __('setup.completed'),
            ],
        ], 201);
    }
}
