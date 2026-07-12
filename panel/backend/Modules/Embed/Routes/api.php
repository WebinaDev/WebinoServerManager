<?php

use Illuminate\Support\Facades\Route;
use Modules\Embed\Http\Controllers\EmbedController;

Route::prefix('v1/embeds')->group(function () {
    Route::get('/phpmyadmin/verify', [EmbedController::class, 'phpMyAdminVerify']);
    Route::get('/phppgadmin/verify', [EmbedController::class, 'phpPgAdminVerify']);
    Route::get('/webmail/verify', [EmbedController::class, 'webmailVerify']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/phpmyadmin/ticket', [EmbedController::class, 'phpMyAdminTicket']);
        Route::post('/phppgadmin/ticket', [EmbedController::class, 'phpPgAdminTicket']);
        Route::post('/webmail/ticket', [EmbedController::class, 'webmailTicket']);
    });
});
