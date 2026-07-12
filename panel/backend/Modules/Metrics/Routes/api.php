<?php

use Illuminate\Support\Facades\Route;
use Modules\Metrics\Http\Controllers\MetricsController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/metrics/current', [MetricsController::class, 'current']);
    Route::get('/metrics/history', [MetricsController::class, 'history']);
    Route::get('/metrics/alerts', [MetricsController::class, 'indexAlerts']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/metrics/alerts', [MetricsController::class, 'storeAlert']);
        Route::patch('/metrics/alerts/{alert}', [MetricsController::class, 'updateAlert']);
        Route::delete('/metrics/alerts/{alert}', [MetricsController::class, 'destroyAlert']);
    });
});
