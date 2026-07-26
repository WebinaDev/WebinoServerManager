<?php

use Illuminate\Support\Facades\Route;
use Modules\Databases\Http\Controllers\DatabaseController;
use Modules\Databases\Http\Controllers\DatabaseUserController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/databases', [DatabaseController::class, 'index']);
    Route::get('/databases/recycle', [DatabaseController::class, 'recycleIndex']);
    Route::get('/databases/root-password', [DatabaseController::class, 'rootPasswordStatus']);
    Route::get('/databases/users', [DatabaseUserController::class, 'index']);
    Route::get('/databases/remote-access', [DatabaseController::class, 'remoteAccess']);
    Route::get('/databases/redis/info', [DatabaseController::class, 'redisInfo']);
    Route::get('/databases/{database}/size', [DatabaseController::class, 'size']);

    Route::middleware('permission:databases.manage')->group(function () {
        Route::post('/databases', [DatabaseController::class, 'store']);
        Route::post('/databases/import', [DatabaseController::class, 'import']);
        Route::post('/databases/root-password', [DatabaseController::class, 'updateRootPassword']);
        Route::post('/databases/remote-access', [DatabaseController::class, 'updateRemoteAccess']);
        Route::post('/databases/recycle/{databaseId}/restore', [DatabaseController::class, 'restoreRecycle']);
        Route::delete('/databases/recycle/{databaseId}', [DatabaseController::class, 'purgeRecycle']);
        Route::post('/databases/{database}/export', [DatabaseController::class, 'export']);
        Route::post('/databases/{database}/repair', [DatabaseController::class, 'repair']);
        Route::post('/databases/{database}/optimize', [DatabaseController::class, 'optimize']);
        Route::post('/databases/{database}/engine', [DatabaseController::class, 'changeEngine']);
        Route::delete('/databases/{database}', [DatabaseController::class, 'destroy']);

        Route::post('/databases/users', [DatabaseUserController::class, 'store']);
        Route::patch('/databases/users/{user}', [DatabaseUserController::class, 'update']);
        Route::delete('/databases/users/{user}', [DatabaseUserController::class, 'destroy']);
    });
});
