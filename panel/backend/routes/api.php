<?php

use Illuminate\Support\Facades\Route;
use Modules\Core\Http\Controllers\AuthController;
use Modules\Core\Http\Controllers\PasswordResetController;
use Modules\Core\Http\Controllers\SetupController;

/*
| WebinoServer panel API — always registered under Laravel's /api prefix.
| Module routes (Modules/*/Routes/api.php) also load /api/v1 and /v1 via ModuleRoutes.
|
| Setup/auth bootstrap routes are declared here so /api/v1/setup works even when
| module route discovery or an outdated image would otherwise miss the api prefix.
*/

Route::get('/v1/health', fn () => response()->json(['status' => 'ok', 'service' => 'webinoserver-panel']));

Route::prefix('v1')->group(function () {
    Route::get('/setup/status', [SetupController::class, 'status']);
    Route::get('/setup/stack', [SetupController::class, 'stackStatus'])->middleware('throttle:60,1');
    Route::post('/setup', [SetupController::class, 'submit'])->middleware('throttle:3,1');
    Route::post('/setup/stack/retry', [SetupController::class, 'retryStack'])->middleware('throttle:6,1');

    Route::get('/auth/gate', [AuthController::class, 'gate']);
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
    Route::post('/auth/session', [AuthController::class, 'session'])->middleware('throttle:20,1');

    Route::get('/mail/status', [PasswordResetController::class, 'mailStatus']);
    Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgot'])
        ->middleware('throttle:6,1');
    Route::post('/auth/reset-password', [PasswordResetController::class, 'reset'])
        ->middleware('throttle:6,1');
});
