<?php

use Illuminate\Support\Facades\Route;
use Modules\System\Http\Controllers\SystemController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/system/info', [SystemController::class, 'index']);
});
