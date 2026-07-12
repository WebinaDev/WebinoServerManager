<?php

use Illuminate\Support\Facades\Route;
use Modules\Databases\Http\Controllers\DatabaseController;
use Modules\Databases\Http\Controllers\DatabaseUserController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/databases', [DatabaseController::class, 'index']);
    Route::get('/databases/users', [DatabaseUserController::class, 'index']);
    Route::get('/databases/remote-access', [DatabaseController::class, 'remoteAccess']);
    Route::get('/databases/{database}/size', [DatabaseController::class, 'size']);

    Route::middleware('permission:databases.manage')->group(function () {
        Route::post('/databases', [DatabaseController::class, 'store']);
        Route::post('/databases/import', [DatabaseController::class, 'import']);
        Route::post('/databases/remote-access', [DatabaseController::class, 'updateRemoteAccess']);
        Route::post('/databases/{database}/export', [DatabaseController::class, 'export']);
        Route::delete('/databases/{database}', [DatabaseController::class, 'destroy']);

        Route::post('/databases/users', [DatabaseUserController::class, 'store']);
        Route::patch('/databases/users/{user}', [DatabaseUserController::class, 'update']);
        Route::delete('/databases/users/{user}', [DatabaseUserController::class, 'destroy']);
    });
});
