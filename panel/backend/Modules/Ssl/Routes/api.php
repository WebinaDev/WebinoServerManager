<?php

use Illuminate\Support\Facades\Route;
use Modules\Ssl\Http\Controllers\SslController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/ssl/certificates', [SslController::class, 'index']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/ssl/certificates', [SslController::class, 'store']);
        Route::post('/ssl/certificates/wildcard', [SslController::class, 'issueWildcard']);
        Route::post('/ssl/certificates/upload', [SslController::class, 'uploadCustom']);
        Route::post('/ssl/validate-chain', [SslController::class, 'validateChain']);
        Route::post('/ssl/certificates/{certificate}/renew', [SslController::class, 'renew']);
        Route::post('/ssl/certificates/{certificate}/bind', [SslController::class, 'bindService']);
        Route::patch('/ssl/certificates/{certificate}', [SslController::class, 'update']);
        Route::delete('/ssl/certificates/{certificate}', [SslController::class, 'destroy']);
    });
});
