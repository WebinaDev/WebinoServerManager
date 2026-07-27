<?php

use Illuminate\Support\Facades\Route;
use Modules\Core\Http\Controllers\AuthController;
use Modules\Core\Http\Controllers\PasswordResetController;
use Modules\Core\Http\Controllers\SetupController;

/*
| Bootstrap panel routes — registered WITHOUT relying on ModuleRoutes.
| Loaded from bootstrap/app.php `then:` so they always exist at /api/v1/*.
*/

Route::prefix('api/v1')->group(function () {
    Route::get('/health', fn () => response()->json(['status' => 'ok', 'service' => 'webinoserver-panel']));

    Route::get('/setup/status', [SetupController::class, 'status']);
    Route::get('/setup/stack', [SetupController::class, 'stackStatus'])->middleware('throttle:60,1');
    Route::post('/setup', [SetupController::class, 'submit'])->middleware('throttle:3,1');
    Route::post('/setup/stack', [SetupController::class, 'submitStackOnly'])->middleware('throttle:3,1');
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
