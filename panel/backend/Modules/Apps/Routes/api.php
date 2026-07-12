<?php

use Illuminate\Support\Facades\Route;
use Modules\Apps\Http\Controllers\AppController;
use Modules\Apps\Http\Controllers\ImageController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/apps', [AppController::class, 'index']);
    Route::get('/apps/images', [ImageController::class, 'index']);

    Route::middleware('permission:apps.manage')->group(function () {
        Route::get('/apps/{app}/logs', [AppController::class, 'logs']);
        Route::post('/apps', [AppController::class, 'store']);
        Route::post('/apps/{app}/start', [AppController::class, 'start']);
        Route::post('/apps/{app}/stop', [AppController::class, 'stop']);
        Route::post('/apps/{app}/restart', [AppController::class, 'restart']);
        Route::delete('/apps/{app}', [AppController::class, 'destroy']);

        Route::post('/apps/images/pull', [ImageController::class, 'pull']);
        Route::delete('/apps/images', [ImageController::class, 'destroy']);
    });
});
