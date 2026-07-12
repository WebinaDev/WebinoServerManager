<?php

use Illuminate\Support\Facades\Route;
use Modules\Platform\Http\Controllers\PlatformController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/platform/status', [PlatformController::class, 'status']);
    Route::get('/sites', [PlatformController::class, 'sites']);

    Route::middleware('permission:platform.manage')->group(function () {
        Route::post('/platform/init', [PlatformController::class, 'init']);
        Route::post('/sites', [PlatformController::class, 'createSite']);
        Route::delete('/sites/{slug}', [PlatformController::class, 'destroySite']);
    });
});
