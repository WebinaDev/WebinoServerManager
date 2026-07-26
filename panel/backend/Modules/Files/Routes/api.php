<?php

use Illuminate\Support\Facades\Route;
use Modules\Files\Http\Controllers\FileShareDownloadController;
use Modules\Files\Http\Controllers\FilesController;

Route::prefix('v1')->group(function () {
    Route::get('/files/share/{token}', FileShareDownloadController::class)
        ->where('token', '[a-f0-9]{48}');

    Route::middleware(['auth:sanctum', 'permission:system.manage'])->group(function () {
        Route::get('/files', [FilesController::class, 'index']);
        Route::post('/files/read', [FilesController::class, 'read']);
        Route::post('/files/write', [FilesController::class, 'write']);
        Route::post('/files/mkdir', [FilesController::class, 'mkdir']);
        Route::post('/files/rename', [FilesController::class, 'rename']);
        Route::post('/files/chmod', [FilesController::class, 'chmod']);
        Route::post('/files/search', [FilesController::class, 'search']);
        Route::post('/files/remote-download', [FilesController::class, 'remoteDownload']);
        Route::get('/files/recycle', [FilesController::class, 'recycleList']);
        Route::post('/files/recycle/restore', [FilesController::class, 'recycleRestore']);
        Route::post('/files/recycle/purge', [FilesController::class, 'recyclePurge']);
        Route::post('/files/versions', [FilesController::class, 'versions']);
        Route::post('/files/versions/restore', [FilesController::class, 'restoreVersion']);
        Route::get('/files/shares', [FilesController::class, 'listShares']);
        Route::post('/files/shares', [FilesController::class, 'createShare']);
        Route::delete('/files/shares/{share}', [FilesController::class, 'destroyShare']);
        Route::delete('/files', [FilesController::class, 'destroy']);
    });
});
