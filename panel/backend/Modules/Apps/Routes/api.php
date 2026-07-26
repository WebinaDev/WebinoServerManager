<?php

use Illuminate\Support\Facades\Route;
use Modules\Apps\Http\Controllers\AppController;
use Modules\Apps\Http\Controllers\ComposeController;
use Modules\Apps\Http\Controllers\DaemonController;
use Modules\Apps\Http\Controllers\ImageController;
use Modules\Apps\Http\Controllers\NetworkController;
use Modules\Apps\Http\Controllers\RegistryController;
use Modules\Apps\Http\Controllers\VolumeController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/apps', [AppController::class, 'index']);
    Route::get('/apps/images', [ImageController::class, 'index']);
    Route::get('/apps/compose', [ComposeController::class, 'index']);
    Route::get('/apps/networks', [NetworkController::class, 'index']);
    Route::get('/apps/volumes', [VolumeController::class, 'index']);
    Route::get('/apps/registries', [RegistryController::class, 'index']);
    Route::get('/apps/daemon', [DaemonController::class, 'show']);

    Route::middleware('permission:apps.manage')->group(function () {
        Route::get('/apps/{app}/logs', [AppController::class, 'logs']);
        Route::post('/apps', [AppController::class, 'store']);
        Route::post('/apps/{app}/start', [AppController::class, 'start']);
        Route::post('/apps/{app}/stop', [AppController::class, 'stop']);
        Route::post('/apps/{app}/restart', [AppController::class, 'restart']);
        Route::delete('/apps/{app}', [AppController::class, 'destroy']);

        Route::post('/apps/images/pull', [ImageController::class, 'pull']);
        Route::delete('/apps/images', [ImageController::class, 'destroy']);

        Route::post('/apps/compose', [ComposeController::class, 'store']);
        Route::post('/apps/compose/{project}/up', [ComposeController::class, 'up']);
        Route::post('/apps/compose/{project}/down', [ComposeController::class, 'down']);
        Route::get('/apps/compose/{project}/logs', [ComposeController::class, 'logs']);
        Route::delete('/apps/compose/{project}', [ComposeController::class, 'destroy']);

        Route::post('/apps/networks', [NetworkController::class, 'store']);
        Route::delete('/apps/networks/{name}', [NetworkController::class, 'destroy']);

        Route::post('/apps/volumes', [VolumeController::class, 'store']);
        Route::delete('/apps/volumes/{name}', [VolumeController::class, 'destroy']);

        Route::post('/apps/registries', [RegistryController::class, 'store']);
        Route::delete('/apps/registries/{registry}', [RegistryController::class, 'destroy']);

        Route::put('/apps/daemon', [DaemonController::class, 'update']);
    });
});
