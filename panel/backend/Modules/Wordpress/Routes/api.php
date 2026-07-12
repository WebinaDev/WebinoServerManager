<?php

use Illuminate\Support\Facades\Route;
use Modules\Wordpress\Http\Controllers\WordpressController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/wordpress', [WordpressController::class, 'index']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/wordpress', [WordpressController::class, 'store']);
        Route::delete('/wordpress/{site}', [WordpressController::class, 'destroy']);
    });
});
