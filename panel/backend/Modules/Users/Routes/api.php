<?php

use Illuminate\Support\Facades\Route;
use Modules\Users\Http\Controllers\RoleController;
use Modules\Users\Http\Controllers\UserController;

Route::prefix('v1')->middleware(['auth:sanctum', 'permission:users.manage'])->group(function () {
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::patch('/users/{user}', [UserController::class, 'update']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    Route::get('/roles', [RoleController::class, 'index']);
    Route::get('/permissions', [RoleController::class, 'permissions']);
    Route::post('/roles', [RoleController::class, 'store']);
    Route::patch('/roles/{role}', [RoleController::class, 'update']);
    Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
});
