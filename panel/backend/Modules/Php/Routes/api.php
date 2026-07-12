<?php

use Illuminate\Support\Facades\Route;
use Modules\Php\Http\Controllers\PhpController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/php/pools', [PhpController::class, 'index']);
    Route::get('/php/ini', [PhpController::class, 'ini']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/php/pools', [PhpController::class, 'store']);
        Route::patch('/php/pools/{pool}', [PhpController::class, 'update']);
        Route::delete('/php/pools/{pool}', [PhpController::class, 'destroy']);
        Route::post('/php/ini', [PhpController::class, 'updateIni']);
        Route::post('/php/extensions', [PhpController::class, 'extensions']);
    });
});
