<?php

use Illuminate\Support\Facades\Route;
use Modules\Backup\Http\Controllers\BackupController;
use Modules\Backup\Http\Controllers\BackupScheduleController;
use Modules\Backup\Http\Controllers\BackupTargetController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/backups/schedules', [BackupScheduleController::class, 'index']);
    Route::get('/backups', [BackupController::class, 'index']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::get('/backups/targets', [BackupTargetController::class, 'index']);
        Route::post('/backups/schedules', [BackupScheduleController::class, 'store']);
        Route::patch('/backups/schedules/{schedule}', [BackupScheduleController::class, 'update']);
        Route::delete('/backups/schedules/{schedule}', [BackupScheduleController::class, 'destroy']);

        Route::post('/backups/targets', [BackupTargetController::class, 'store']);
        Route::patch('/backups/targets/{target}', [BackupTargetController::class, 'update']);
        Route::delete('/backups/targets/{target}', [BackupTargetController::class, 'destroy']);

        Route::post('/backups', [BackupController::class, 'store']);
        Route::post('/backups/{backup}/restore', [BackupController::class, 'restore']);
        Route::post('/backups/{backup}/verify', [BackupController::class, 'verify']);
        Route::get('/backups/{backup}/download', [BackupController::class, 'download']);
        Route::delete('/backups/{backup}', [BackupController::class, 'destroy']);
    });
});
