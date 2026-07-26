<?php

use Illuminate\Support\Facades\Route;
use Modules\Hosting\Http\Controllers\HostingAccountController;
use Modules\Hosting\Http\Controllers\HostingPlanController;
use Modules\Hosting\Http\Controllers\HostingQuotaAlertController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/hosting/plans', [HostingPlanController::class, 'index']);
    Route::get('/hosting/accounts', [HostingAccountController::class, 'index']);
    Route::get('/hosting/accounts/{account}', [HostingAccountController::class, 'show']);
    Route::get('/hosting/accounts/{account}/usage', [HostingAccountController::class, 'usage']);
    Route::get('/hosting/accounts/{account}/quota-alerts', [HostingQuotaAlertController::class, 'index']);

    Route::middleware('permission:hosting.manage')->group(function () {
        Route::post('/hosting/plans', [HostingPlanController::class, 'store']);
        Route::patch('/hosting/plans/{plan}', [HostingPlanController::class, 'update']);
        Route::delete('/hosting/plans/{plan}', [HostingPlanController::class, 'destroy']);

        Route::post('/hosting/accounts', [HostingAccountController::class, 'store']);
        Route::patch('/hosting/accounts/{account}', [HostingAccountController::class, 'update']);
        Route::delete('/hosting/accounts/{account}', [HostingAccountController::class, 'destroy']);
        Route::post('/hosting/accounts/{account}/suspend', [HostingAccountController::class, 'suspend']);
        Route::post('/hosting/accounts/{account}/unsuspend', [HostingAccountController::class, 'unsuspend']);

        Route::post('/hosting/accounts/{account}/quota-alerts', [HostingQuotaAlertController::class, 'store']);
        Route::patch('/hosting/accounts/{account}/quota-alerts/{alert}', [HostingQuotaAlertController::class, 'update']);
        Route::delete('/hosting/accounts/{account}/quota-alerts/{alert}', [HostingQuotaAlertController::class, 'destroy']);
    });
});
