<?php

use Illuminate\Support\Facades\Route;
use Modules\Websites\Http\Controllers\WebsiteController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/websites', [WebsiteController::class, 'index']);
    Route::get('/websites/rewrite-templates', [WebsiteController::class, 'rewriteTemplates']);
    Route::get('/websites/{website}', [WebsiteController::class, 'show']);
    Route::get('/websites/{website}/logs', [WebsiteController::class, 'logs']);

    Route::middleware('permission:domains.manage')->group(function () {
        Route::post('/websites', [WebsiteController::class, 'store']);
        Route::patch('/websites/{website}', [WebsiteController::class, 'update']);
        Route::delete('/websites/{website}', [WebsiteController::class, 'destroy']);
        Route::post('/websites/{website}/htpasswd', [WebsiteController::class, 'htpasswd']);
        Route::post('/websites/{website}/composer', [WebsiteController::class, 'composer']);
    });
});
