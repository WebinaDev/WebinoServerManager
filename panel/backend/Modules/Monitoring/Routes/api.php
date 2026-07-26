<?php

use Illuminate\Support\Facades\Route;
use Modules\Monitoring\Http\Controllers\LogController;
use Modules\Monitoring\Http\Controllers\NotificationChannelController;
use Modules\Monitoring\Http\Controllers\ProcessController;
use Modules\Monitoring\Http\Controllers\ServiceController;
use Modules\Monitoring\Http\Controllers\UptimeController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::middleware('permission:monitoring.manage')->group(function () {
        Route::get('/monitoring/services', [ServiceController::class, 'index']);
        Route::get('/monitoring/processes', [ProcessController::class, 'index']);
        Route::post('/monitoring/processes/kill', [ProcessController::class, 'kill']);
        Route::get('/monitoring/uptime', [UptimeController::class, 'index']);
        Route::get('/monitoring/uptime/{check}/results', [UptimeController::class, 'results']);
        Route::get('/monitoring/logs/sources', [LogController::class, 'sources']);
        Route::get('/monitoring/logs', [LogController::class, 'tail']);
        Route::get('/monitoring/channels', [NotificationChannelController::class, 'index']);

        Route::post('/monitoring/services/action', [ServiceController::class, 'action']);

        Route::post('/monitoring/uptime', [UptimeController::class, 'store']);
        Route::patch('/monitoring/uptime/{check}', [UptimeController::class, 'update']);
        Route::delete('/monitoring/uptime/{check}', [UptimeController::class, 'destroy']);

        Route::post('/monitoring/channels', [NotificationChannelController::class, 'store']);
        Route::patch('/monitoring/channels/{channel}', [NotificationChannelController::class, 'update']);
        Route::delete('/monitoring/channels/{channel}', [NotificationChannelController::class, 'destroy']);
        Route::post('/monitoring/channels/{channel}/test', [NotificationChannelController::class, 'test']);
    });
});
