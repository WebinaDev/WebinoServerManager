<?php

use Illuminate\Support\Facades\Route;
use Modules\Subdomains\Http\Controllers\SubdomainController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/subdomains', [SubdomainController::class, 'index']);

    Route::middleware('permission:domains.manage')->group(function () {
        Route::post('/subdomains', [SubdomainController::class, 'store']);
        Route::patch('/subdomains/{subdomain}', [SubdomainController::class, 'update']);
        Route::delete('/subdomains/{subdomain}', [SubdomainController::class, 'destroy']);
    });
});
