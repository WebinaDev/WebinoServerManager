<?php

use Illuminate\Support\Facades\Route;
use Modules\Webserver\Http\Controllers\ProxyController;
use Modules\Webserver\Http\Controllers\RedirectController;
use Modules\Webserver\Http\Controllers\VhostController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/webserver/vhosts', [VhostController::class, 'index']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::get('/webserver/vhosts/{vhost}', [VhostController::class, 'show']);
        Route::post('/webserver/vhosts', [VhostController::class, 'store']);
        Route::put('/webserver/vhosts/{vhost}', [VhostController::class, 'update']);
        Route::delete('/webserver/vhosts/{vhost}', [VhostController::class, 'destroy']);
        Route::post('/webserver/vhosts/{vhost}/ssl', [VhostController::class, 'enableSsl']);
        Route::post('/webserver/vhosts/{vhost}/hsts', [VhostController::class, 'enableHsts']);
        Route::post('/webserver/vhosts/{vhost}/redirects', [RedirectController::class, 'store']);
        Route::post('/webserver/vhosts/{vhost}/proxy', [ProxyController::class, 'store']);
    });
});
