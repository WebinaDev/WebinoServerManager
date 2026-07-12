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
});
