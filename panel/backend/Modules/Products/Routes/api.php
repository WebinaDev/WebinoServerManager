<?php

use Illuminate\Support\Facades\Route;
use Modules\Products\Http\Controllers\ProductController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/products', [ProductController::class, 'index']);

    Route::middleware('permission:platform.manage')->group(function () {
        Route::post('/products/install', [ProductController::class, 'install']);
    });
});
