<?php

use Illuminate\Support\Facades\Route;
use Modules\Domains\Http\Controllers\DomainController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/domains', [DomainController::class, 'index']);

    Route::middleware('permission:domains.manage')->group(function () {
        Route::post('/domains', [DomainController::class, 'store']);
        Route::delete('/domains/{domain}', [DomainController::class, 'destroy']);
    });
});
