<?php

use Illuminate\Support\Facades\Route;
use Modules\Core\Http\Controllers\ApiTokenController;
use Modules\Core\Http\Controllers\AuthController;
use Modules\Core\Http\Controllers\DashboardController;
use Modules\Core\Http\Controllers\NavigationController;
use Modules\Core\Http\Controllers\OpenApiController;
use Modules\Core\Http\Controllers\PasswordResetController;
use Modules\Core\Http\Controllers\SetupController;
use Modules\Core\Http\Controllers\TerminalController;
use Modules\Core\Http\Controllers\TwoFactorController;

Route::prefix('v1')->group(function () {
    Route::get('/setup/status', [SetupController::class, 'status']);
    Route::get('/setup/stack', [SetupController::class, 'stackStatus'])->middleware('throttle:60,1');
    Route::post('/setup', [SetupController::class, 'submit'])->middleware('throttle:3,1');
    Route::post('/setup/stack', [SetupController::class, 'submitStackOnly'])->middleware('throttle:3,1');
    Route::post('/setup/stack/retry', [SetupController::class, 'retryStack'])->middleware('throttle:6,1');
    Route::get('/openapi.json', [OpenApiController::class, 'show']);

    Route::get('/mail/status', [PasswordResetController::class, 'mailStatus']);
    Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgot'])
        ->middleware('throttle:6,1');
    Route::post('/auth/reset-password', [PasswordResetController::class, 'reset'])
        ->middleware('throttle:6,1');

    Route::get('/auth/gate', [AuthController::class, 'gate']);

    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
    Route::post('/auth/session', [AuthController::class, 'session'])->middleware('throttle:20,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/check', [AuthController::class, 'check']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/refresh', [AuthController::class, 'refresh']);
        Route::get('/auth/user', [AuthController::class, 'user']);
        Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);

        Route::middleware('permission:tokens.manage')->group(function () {
            Route::get('/auth/tokens', [ApiTokenController::class, 'index']);
            Route::post('/auth/tokens', [ApiTokenController::class, 'store']);
            Route::delete('/auth/tokens/{token}', [ApiTokenController::class, 'destroy']);
        });

        Route::get('/navigation', [NavigationController::class, 'index']);
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

        Route::middleware('permission:system.manage')->group(function () {
            Route::post('/terminal/ticket', [TerminalController::class, 'ticket']);
        });

        Route::prefix('auth/2fa')->group(function () {
            Route::get('/status', [TwoFactorController::class, 'status']);
            Route::post('/enable', [TwoFactorController::class, 'enable']);
            Route::post('/confirm', [TwoFactorController::class, 'confirm']);
            Route::post('/disable', [TwoFactorController::class, 'disable']);
            Route::post('/verify', [TwoFactorController::class, 'verify']);
        });
    });
});
