<?php

use Illuminate\Support\Facades\Route;
use Modules\Ftp\Http\Controllers\FtpController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/ftp/accounts', [FtpController::class, 'index']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/ftp/accounts', [FtpController::class, 'store']);
        Route::delete('/ftp/accounts/{account}', [FtpController::class, 'destroy']);
    });
});
