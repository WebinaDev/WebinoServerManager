<?php

use Illuminate\Support\Facades\Route;
use Modules\Runtimes\Http\Controllers\RuntimesController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/runtimes/versions', [RuntimesController::class, 'versions']);
    Route::get('/runtimes/projects', [RuntimesController::class, 'projects']);
    Route::get('/runtimes/projects/{project}/logs', [RuntimesController::class, 'logs']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/runtimes/versions/{version}/install', [RuntimesController::class, 'installVersion']);
        Route::post('/runtimes/projects', [RuntimesController::class, 'storeProject']);
        Route::post('/runtimes/projects/{project}/start', [RuntimesController::class, 'start']);
        Route::post('/runtimes/projects/{project}/stop', [RuntimesController::class, 'stop']);
        Route::post('/runtimes/projects/{project}/restart', [RuntimesController::class, 'restart']);
        Route::delete('/runtimes/projects/{project}', [RuntimesController::class, 'destroy']);
    });
});
