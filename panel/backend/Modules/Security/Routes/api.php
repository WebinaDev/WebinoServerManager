<?php

use Illuminate\Support\Facades\Route;
use Modules\Security\Http\Controllers\AuditLogController;
use Modules\Security\Http\Controllers\ClamAvController;
use Modules\Security\Http\Controllers\Fail2banController;
use Modules\Security\Http\Controllers\FirewallController;
use Modules\Security\Http\Controllers\SshKeyController;
use Modules\Security\Http\Controllers\WafController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::middleware('permission:security.manage')->group(function () {
        Route::get('/security/firewall', [FirewallController::class, 'index']);
        Route::get('/security/firewall/allowlist', [FirewallController::class, 'allowlist']);
        Route::get('/security/fail2ban', [Fail2banController::class, 'index']);
        Route::get('/security/fail2ban/filters', [Fail2banController::class, 'filters']);
        Route::get('/security/sshkeys', [SshKeyController::class, 'index']);
        Route::get('/security/waf', [WafController::class, 'index']);
        Route::get('/security/clamav/history', [ClamAvController::class, 'history']);
        Route::get('/security/clamav/schedule', [ClamAvController::class, 'getSchedule']);
        Route::post('/security/clamav/schedule', [ClamAvController::class, 'updateSchedule']);
        Route::get('/security/audit-log', [AuditLogController::class, 'index']);
        Route::get('/security/login-history', [AuditLogController::class, 'loginHistory']);
        Route::post('/security/firewall', [FirewallController::class, 'store']);
        Route::post('/security/firewall/allowlist', [FirewallController::class, 'updateAllowlist']);
        Route::post('/security/fail2ban/unban', [Fail2banController::class, 'unban']);
        Route::post('/security/fail2ban/filters', [Fail2banController::class, 'storeFilter']);
        Route::post('/security/sshkeys', [SshKeyController::class, 'store']);
        Route::post('/security/clamav/scan', [ClamAvController::class, 'scan']);
        Route::post('/security/waf', [WafController::class, 'update']);
    });
});
