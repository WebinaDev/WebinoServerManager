<?php

use Illuminate\Support\Facades\Route;
use Modules\Files\Http\Controllers\FilesController;

Route::prefix('v1')->middleware(['auth:sanctum', 'permission:system.manage'])->group(function () {
    Route::get('/files', [FilesController::class, 'index']);
    Route::post('/files/read', [FilesController::class, 'read']);
    Route::post('/files/write', [FilesController::class, 'write']);
    Route::post('/files/mkdir', [FilesController::class, 'mkdir']);
    Route::delete('/files', [FilesController::class, 'destroy']);
});
