<?php

use Illuminate\Support\Facades\Route;
use Modules\Dns\Http\Controllers\DnsController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/dns/zones', [DnsController::class, 'indexZones']);
    Route::get('/dns/templates', [DnsController::class, 'indexTemplates']);
    Route::get('/dns/zones/{zone}/records', [DnsController::class, 'indexRecords']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::get('/dns/zones/{zone}/export', [DnsController::class, 'exportZone']);
        Route::post('/dns/zones', [DnsController::class, 'storeZone']);
        Route::post('/dns/zones/slave', [DnsController::class, 'storeSlaveZone']);
        Route::delete('/dns/zones/{zone}', [DnsController::class, 'destroyZone']);
        Route::post('/dns/zones/{zone}/dnssec', [DnsController::class, 'enableDnssec']);
        Route::delete('/dns/zones/{zone}/dnssec', [DnsController::class, 'disableDnssec']);
        Route::post('/dns/zones/{zone}/import', [DnsController::class, 'importZone']);
        Route::post('/dns/zones/{zone}/template', [DnsController::class, 'applyTemplate']);
        Route::post('/dns/records', [DnsController::class, 'storeRecord']);
        Route::patch('/dns/records/{record}', [DnsController::class, 'updateRecord']);
        Route::delete('/dns/records/{record}', [DnsController::class, 'destroyRecord']);
    });
});
