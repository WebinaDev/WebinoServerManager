<?php

use Illuminate\Support\Facades\Route;
use Modules\Email\Http\Controllers\AntispamController;
use Modules\Email\Http\Controllers\AutoresponderController;
use Modules\Email\Http\Controllers\EmailController;
use Modules\Email\Http\Controllers\MailAuthController;
use Modules\Email\Http\Controllers\MailQueueController;
use Modules\Email\Http\Controllers\MailingListController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::get('/email/domains', [EmailController::class, 'indexDomains']);
    Route::get('/email/accounts', [EmailController::class, 'indexAccounts']);
    Route::get('/email/forwarders', [EmailController::class, 'indexForwarders']);
    Route::get('/email/autoresponders', [AutoresponderController::class, 'index']);
    Route::get('/email/lists', [MailingListController::class, 'index']);
    Route::get('/email/antispam', [AntispamController::class, 'index']);
    Route::get('/email/domains/{domain}/auth/validate', [MailAuthController::class, 'validateDns']);

    Route::middleware('permission:system.manage')->group(function () {
        Route::get('/email/queue', [MailQueueController::class, 'index']);
        Route::post('/email/domains', [EmailController::class, 'storeDomain']);
        Route::delete('/email/domains/{domain}', [EmailController::class, 'destroyDomain']);
        Route::patch('/email/domains/{domain}/catchall', [EmailController::class, 'updateDomainCatchall']);
        Route::post('/email/domains/{domain}/auth/generate', [MailAuthController::class, 'generate']);
        Route::post('/email/accounts', [EmailController::class, 'storeAccount']);
        Route::patch('/email/accounts/{account}/password', [EmailController::class, 'updateAccountPassword']);
        Route::patch('/email/accounts/{account}/quota', [EmailController::class, 'updateAccountQuota']);
        Route::delete('/email/accounts/{account}', [EmailController::class, 'destroyAccount']);
        Route::post('/email/forwarders', [EmailController::class, 'storeForwarder']);
        Route::delete('/email/forwarders/{forwarder}', [EmailController::class, 'destroyForwarder']);
        Route::post('/email/autoresponders', [AutoresponderController::class, 'store']);
        Route::delete('/email/autoresponders/{autoresponder}', [AutoresponderController::class, 'destroy']);
        Route::post('/email/lists', [MailingListController::class, 'store']);
        Route::patch('/email/lists/{list}', [MailingListController::class, 'update']);
        Route::post('/email/lists/{list}/members', [MailingListController::class, 'addMember']);
        Route::delete('/email/lists/{list}/members', [MailingListController::class, 'removeMember']);
        Route::delete('/email/lists/{list}', [MailingListController::class, 'destroy']);
        Route::post('/email/queue/flush', [MailQueueController::class, 'flush']);
        Route::delete('/email/queue', [MailQueueController::class, 'destroy']);
        Route::post('/email/antispam', [AntispamController::class, 'update']);
    });
});
