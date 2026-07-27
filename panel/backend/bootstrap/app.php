<?php

use App\Http\Middleware\EnforceTokenAbilities;
use App\Http\Middleware\ThrottleApiToken;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Always register /api/v1/setup + auth bootstrap (independent of module route loader)
            require __DIR__.'/../routes/panel-bootstrap.php';
        },
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('panel:collect-metrics')->everyMinute();
        $schedule->command('panel:run-scheduled-backups')->everyMinute();
        $schedule->command('panel:reconcile-host')->everyFifteenMinutes();
        $schedule->command('panel:clamav-scan')->weekly();
        $schedule->command('panel:renew-ssl')->daily();
        $schedule->command('panel:check-ssl-expiry')->daily();
        $schedule->command('panel:collect-hosting-usage')->hourly();
        $schedule->command('panel:check-uptime')->everyMinute();
        $schedule->command('panel:check-cron-failures')->everyFiveMinutes();
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->redirectGuestsTo(null);
        $middleware->encryptCookies(except: [
            env('AUTH_COOKIE_NAME', 'webino_auth_token'),
        ]);
        // Bridge the auth cookie into a Bearer token for EVERY request. Module
        // routes (Modules/*/Routes/api.php) are registered via loadRoutesFrom()
        // and are NOT in the "api" group, so registering this only on the api
        // group left all /v1/* protected routes unable to see the cookie (401),
        // which caused the login <-> dashboard redirect loop.
        $middleware->prepend(\App\Http\Middleware\AuthenticateFromCookie::class);
        $middleware->api(prepend: [
            \App\Http\Middleware\ForceJsonResponse::class,
            \App\Http\Middleware\ApiResponseFormatter::class,
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
            \App\Http\Middleware\IpAllowlistMiddleware::class,
        ]);
        $middleware->api(append: [
            \App\Http\Middleware\RequireTwoFactor::class,
            ThrottleApiToken::class,
            EnforceTokenAbilities::class,
            \App\Http\Middleware\LogAuditAction::class,
        ]);
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
