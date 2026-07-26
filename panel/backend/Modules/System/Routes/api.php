<?php

use Illuminate\Support\Facades\Route;
use Modules\System\Http\Controllers\PanelSettingsController;
use Modules\System\Http\Controllers\SystemController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/system/info', [SystemController::class, 'index']);
    Route::get('/panel/settings', [PanelSettingsController::class, 'index']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::get('/system/disk', [SystemController::class, 'disk']);
        Route::post('/system/disk/cleanup', [SystemController::class, 'diskCleanup']);
        Route::patch('/panel/settings/network', [PanelSettingsController::class, 'updateNetwork']);
        Route::post('/panel/restart', [PanelSettingsController::class, 'restartPanel']);
        Route::post('/panel/reboot/confirm', [PanelSettingsController::class, 'requestRebootConfirm']);
        Route::post('/panel/reboot', [PanelSettingsController::class, 'rebootOs']);
        Route::post('/panel/repair', [PanelSettingsController::class, 'repair']);
    });
});
