<?php

use Illuminate\Support\Facades\Route;
use Modules\Cron\Http\Controllers\CronController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::middleware('permission:system.manage')->group(function () {
        Route::get('/cron/jobs', [CronController::class, 'index']);
        Route::get('/cron/scripts', [CronController::class, 'scriptLibrary']);
        Route::post('/cron/jobs', [CronController::class, 'store']);
        Route::delete('/cron/jobs/{job}', [CronController::class, 'destroy']);
    });
});