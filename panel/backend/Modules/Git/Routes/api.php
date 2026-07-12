<?php

use Illuminate\Support\Facades\Route;
use Modules\Git\Http\Controllers\GitController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/git', [GitController::class, 'index']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/git', [GitController::class, 'store']);
        Route::post('/git/{repo}/pull', [GitController::class, 'pull']);
        Route::delete('/git/{repo}', [GitController::class, 'destroy']);
    });
});
