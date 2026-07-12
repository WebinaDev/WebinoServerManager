<?php

use Illuminate\Support\Facades\Route;
use Modules\Webhooks\Http\Controllers\WebhookController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::middleware('permission:webhooks.manage')->group(function () {
        Route::get('/webhooks', [WebhookController::class, 'index']);
        Route::get('/webhooks/deliveries', [WebhookController::class, 'deliveries']);
        Route::post('/webhooks', [WebhookController::class, 'store']);
        Route::patch('/webhooks/{endpoint}', [WebhookController::class, 'update']);
        Route::delete('/webhooks/{endpoint}', [WebhookController::class, 'destroy']);
        Route::post('/webhooks/{endpoint}/test', [WebhookController::class, 'test']);
    });
});
