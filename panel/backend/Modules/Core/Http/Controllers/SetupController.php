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
use Modules\Core\Entities\SetupStackRun;
use Modules\Core\Jobs\RunSetupStackJob;
use Modules\Core\Services\SetupStackPlanner;
use Spatie\Permission\Models\Role;

class SetupController extends Controller
{
    public function __construct(
        private readonly PanelEnvPatcher $envPatcher,
        private readonly SetupStackPlanner $stackPlanner,
    ) {}

    public function status(): JsonResponse
    {
        $run = SetupStackRun::query()->latest('id')->first();

        return response()->json([
            'data' => [
                'needs_setup' => needs_setup(),
                'setup_completed' => setup_completed(),
                'admin_created' => panel_admin_exists(),
                'needs_stack' => panel_admin_exists() && ! setup_completed(),
                'stack' => $this->serializeStack($run),
            ],
        ]);
    }

    public function stackStatus(): JsonResponse
    {
        $run = SetupStackRun::query()->with('steps')->latest('id')->first();

        return response()->json([
            'data' => [
                'needs_setup' => needs_setup(),
                'setup_completed' => setup_completed(),
                'admin_created' => panel_admin_exists(),
                'needs_stack' => panel_admin_exists() && ! setup_completed(),
                'stack' => $this->serializeStack($run),
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

        // Post-login (aaPanel-style): admin already exists → start hosting stack only.
        if (panel_admin_exists()) {
            return $this->submitStackOnly($request);
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
            'stack' => ['nullable', 'array'],
            'stack.skip' => ['sometimes', 'boolean'],
            'stack.webserver' => ['nullable', 'in:nginx,apache'],
            'stack.database' => ['nullable', 'in:mariadb,mysql'],
            'stack.php_versions' => ['nullable', 'array'],
            'stack.php_versions.*' => ['in:8.1,8.2,8.3,8.4'],
            'stack.redis' => ['sometimes', 'boolean'],
            'stack.memcached' => ['sometimes', 'boolean'],
            'stack.pureftpd' => ['sometimes', 'boolean'],
        ]);

        [$stackConfig, $skip] = $this->normalizeStackConfig($data['stack'] ?? []);
        if ($stackConfig === null) {
            return response()->json(['message' => __('setup.php_required')], 422);
        }

        $planned = $this->stackPlanner->plan($stackConfig);
        $runId = null;

        DB::transaction(function () use ($data, $stackConfig, $skip, $planned, &$runId): void {
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
                    PanelSetting::setEncrypted('smtp_password', $data['smtp_password']);
                }
                PanelSetting::set('smtp_encryption', $data['smtp_encryption'] ?? 'tls');
                if (! empty($data['smtp_from_address'])) {
                    PanelSetting::set('smtp_from_address', $data['smtp_from_address']);
                }
                if (! empty($data['smtp_from_name'])) {
                    PanelSetting::set('smtp_from_name', $data['smtp_from_name']);
                }
            }

            PanelSetting::set('setup_completed', false);

            $runId = $this->createStackRun($stackConfig, $skip, $planned);
        });

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        $port = (int) config('app.panel_http_port', env('PANEL_HTTP_PORT', 2090));
        $host = ! empty($data['hostname'])
            ? (string) $data['hostname']
            : $request->getHost();
        if ($host !== '' && $host !== 'localhost' && $host !== '127.0.0.1') {
            $this->envPatcher->applyHostname($host, $port, $request->isSecure());
        }

        if ($runId !== null) {
            RunSetupStackJob::dispatch($runId);
        }

        $run = SetupStackRun::query()->with('steps')->find($runId);

        return response()->json([
            'data' => [
                'needs_setup' => needs_setup(),
                'setup_completed' => setup_completed(),
                'admin_created' => true,
                'needs_stack' => ! setup_completed(),
                'stack' => $this->serializeStack($run),
                'message' => setup_completed()
                    ? __('setup.completed')
                    : __('setup.stack_started'),
            ],
        ], 201);
    }

    /**
     * Start or skip hosting stack when admin already exists (post-login wizard).
     */
    public function submitStackOnly(Request $request): JsonResponse
    {
        if (setup_completed()) {
            return response()->json(['message' => __('setup.already_completed')], 409);
        }

        if (! panel_admin_exists()) {
            return response()->json(['message' => __('setup.admin_required')], 422);
        }

        $active = SetupStackRun::query()
            ->whereIn('status', ['pending', 'running'])
            ->latest('id')
            ->first();
        if ($active !== null) {
            return response()->json([
                'message' => __('setup.already_in_progress'),
                'data' => [
                    'needs_setup' => needs_setup(),
                    'setup_completed' => false,
                    'admin_created' => true,
                    'needs_stack' => true,
                    'stack' => $this->serializeStack($active->load('steps')),
                ],
            ], 409);
        }

        $data = $request->validate([
            'stack' => ['required', 'array'],
            'stack.skip' => ['sometimes', 'boolean'],
            'stack.webserver' => ['nullable', 'in:nginx,apache'],
            'stack.database' => ['nullable', 'in:mariadb,mysql'],
            'stack.php_versions' => ['nullable', 'array'],
            'stack.php_versions.*' => ['in:8.1,8.2,8.3,8.4'],
            'stack.redis' => ['sometimes', 'boolean'],
            'stack.memcached' => ['sometimes', 'boolean'],
            'stack.pureftpd' => ['sometimes', 'boolean'],
        ]);

        [$stackConfig, $skip] = $this->normalizeStackConfig($data['stack']);
        if ($stackConfig === null) {
            return response()->json(['message' => __('setup.php_required')], 422);
        }

        $planned = $this->stackPlanner->plan($stackConfig);
        $runId = $this->createStackRun($stackConfig, $skip, $planned);
        RunSetupStackJob::dispatch($runId);

        $run = SetupStackRun::query()->with('steps')->find($runId);

        return response()->json([
            'data' => [
                'needs_setup' => needs_setup(),
                'setup_completed' => setup_completed(),
                'admin_created' => true,
                'needs_stack' => ! setup_completed(),
                'stack' => $this->serializeStack($run),
                'message' => __('setup.stack_started'),
            ],
        ], 201);
    }

    public function retryStack(): JsonResponse
    {
        if (setup_completed()) {
            return response()->json(['message' => __('setup.already_completed')], 409);
        }

        $run = SetupStackRun::query()->with('steps')->latest('id')->first();
        if ($run === null) {
            return response()->json(['message' => __('setup.stack_not_found')], 404);
        }
        if ($run->status === 'running') {
            return response()->json([
                'data' => ['stack' => $this->serializeStack($run)],
                'message' => __('setup.stack_running'),
            ]);
        }

        foreach ($run->steps as $step) {
            if ($step->status === 'failed') {
                $step->update(['status' => 'pending', 'log' => null]);
            }
        }
        $run->update(['status' => 'pending', 'error' => null]);
        RunSetupStackJob::dispatch($run->id);

        $run->refresh()->load('steps');

        return response()->json([
            'data' => [
                'needs_setup' => needs_setup(),
                'setup_completed' => setup_completed(),
                'admin_created' => panel_admin_exists(),
                'needs_stack' => panel_admin_exists() && ! setup_completed(),
                'stack' => $this->serializeStack($run),
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $stackConfig
     * @return array{0: array<string, mixed>|null, 1: bool}
     */
    private function normalizeStackConfig(array $stackConfig): array
    {
        $skip = (bool) ($stackConfig['skip'] ?? false);
        if ($skip) {
            return [['skip' => true], true];
        }

        $stackConfig['webserver'] = $stackConfig['webserver'] ?? 'nginx';
        $stackConfig['database'] = $stackConfig['database'] ?? 'mariadb';
        $phpVersions = $stackConfig['php_versions'] ?? ['8.2', '8.3'];
        if (! is_array($phpVersions) || $phpVersions === []) {
            return [null, false];
        }
        $stackConfig['php_versions'] = array_values($phpVersions);
        $stackConfig['redis'] = (bool) ($stackConfig['redis'] ?? false);
        $stackConfig['memcached'] = (bool) ($stackConfig['memcached'] ?? false);
        $stackConfig['pureftpd'] = (bool) ($stackConfig['pureftpd'] ?? false);
        $stackConfig['skip'] = false;

        return [$stackConfig, false];
    }

    /**
     * @param  array<string, mixed>  $stackConfig
     * @param  list<array{slug: string, script_id: string, label: string}>  $planned
     */
    private function createStackRun(array $stackConfig, bool $skip, array $planned): int
    {
        $run = SetupStackRun::query()->create([
            'status' => $skip ? 'skipped' : 'pending',
            'skip' => $skip,
            'config' => $stackConfig,
        ]);

        foreach ($planned as $i => $step) {
            $run->steps()->create([
                'position' => $i + 1,
                'slug' => $step['slug'],
                'script_id' => $step['script_id'],
                'label' => $step['label'],
                'status' => 'pending',
            ]);
        }

        return (int) $run->id;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function serializeStack(?SetupStackRun $run): ?array
    {
        if ($run === null) {
            return null;
        }

        $run->loadMissing('steps');
        $steps = $run->steps;
        $total = max(1, $steps->count());
        $done = $steps->whereIn('status', ['success', 'skipped'])->count();
        $percent = $run->skip || $run->status === 'skipped'
            ? 100
            : (int) floor(($done / $total) * 100);
        if ($run->status === 'success') {
            $percent = 100;
        }

        return [
            'id' => $run->id,
            'status' => $run->status,
            'skip' => $run->skip,
            'percent' => $percent,
            'error' => $run->error,
            'config' => $run->config,
            'steps' => $steps->map(fn ($s) => [
                'id' => $s->id,
                'position' => $s->position,
                'slug' => $s->slug,
                'script_id' => $s->script_id,
                'label' => $s->label,
                'status' => $s->status,
                'log' => $s->log,
            ])->values()->all(),
        ];
    }
}
