<?php

use Illuminate\Support\Facades\Route;
use Modules\Softstore\Http\Controllers\SoftstoreController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/softstore/packages', [SoftstoreController::class, 'packages']);
    Route::get('/softstore/installs', [SoftstoreController::class, 'installs']);
    Route::get('/softstore/installs/{install}', [SoftstoreController::class, 'showInstall']);
    Route::get('/softstore/pins', [SoftstoreController::class, 'pins']);
    Route::post('/softstore/pins', [SoftstoreController::class, 'pin']);
    Route::delete('/softstore/pins/{packageId}', [SoftstoreController::class, 'unpin']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::post('/softstore/packages/{slug}/install', [SoftstoreController::class, 'install']);
        Route::post('/softstore/packages/{slug}/upgrade', [SoftstoreController::class, 'upgrade']);
        Route::post('/softstore/packages/{slug}/uninstall', [SoftstoreController::class, 'uninstall']);
    });
});
