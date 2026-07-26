<?php

use Illuminate\Support\Facades\Route;
use Modules\Support\Http\Controllers\SupportController;

Route::prefix('v1/support')->middleware('auth:sanctum')->group(function () {
    Route::get('/tickets', [SupportController::class, 'index']);
    Route::get('/tickets/{ticket}', [SupportController::class, 'show']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/tickets', [SupportController::class, 'store']);
        Route::post('/tickets/{ticket}/replies', [SupportController::class, 'reply']);
        Route::post('/tickets/{ticket}/close', [SupportController::class, 'close']);
        Route::post('/tickets/{ticket}/reopen', [SupportController::class, 'reopen']);
    });
});
