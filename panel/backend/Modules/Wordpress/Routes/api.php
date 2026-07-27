<?php

use Illuminate\Support\Facades\Route;
use Modules\Wordpress\Http\Controllers\WordpressController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/wordpress', [WordpressController::class, 'index']);
    Route::get('/wordpress/{site}/themes', [WordpressController::class, 'themes']);
    Route::get('/wordpress/{site}/plugins', [WordpressController::class, 'plugins']);
    Route::post('/wordpress/{site}/integrity', [WordpressController::class, 'integrity']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/wordpress', [WordpressController::class, 'store']);
        Route::delete('/wordpress/{site}', [WordpressController::class, 'destroy']);
        Route::post('/wordpress/{site}/clone', [WordpressController::class, 'cloneSite']);
        Route::post('/wordpress/{site}/migrate', [WordpressController::class, 'migrate']);
        Route::post('/wordpress/{site}/staging', [WordpressController::class, 'staging']);
        Route::post('/wordpress/{site}/themes/update', [WordpressController::class, 'updateThemes']);
        Route::post('/wordpress/{site}/themes/activate', [WordpressController::class, 'activateTheme']);
        Route::post('/wordpress/{site}/plugins/update', [WordpressController::class, 'updatePlugins']);
        Route::post('/wordpress/{site}/plugins/toggle', [WordpressController::class, 'togglePlugin']);
    });
});
