<?php

use Illuminate\Support\Facades\Route;
use Modules\Security\Http\Controllers\AuditLogController;
use Modules\Security\Http\Controllers\ClamAvController;
use Modules\Security\Http\Controllers\Fail2banController;
use Modules\Security\Http\Controllers\FirewallController;
use Modules\Security\Http\Controllers\RiskController;
use Modules\Security\Http\Controllers\SshKeyController;
use Modules\Security\Http\Controllers\TamperController;
use Modules\Security\Http\Controllers\WafController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::middleware('permission:security.manage')->group(function () {
        Route::get('/security/firewall', [FirewallController::class, 'index']);
        Route::get('/security/firewall/allowlist', [FirewallController::class, 'allowlist']);
        Route::get('/security/fail2ban', [Fail2banController::class, 'index']);
        Route::get('/security/fail2ban/filters', [Fail2banController::class, 'filters']);
        Route::get('/security/sshkeys', [SshKeyController::class, 'index']);
        Route::get('/security/waf', [WafController::class, 'index']);
        Route::get('/security/waf/sites', [WafController::class, 'sites']);
        Route::get('/security/waf/logs', [WafController::class, 'logs']);
        Route::get('/security/clamav/history', [ClamAvController::class, 'history']);
        Route::get('/security/clamav/schedule', [ClamAvController::class, 'getSchedule']);
        Route::post('/security/clamav/schedule', [ClamAvController::class, 'updateSchedule']);
        Route::get('/security/audit-log', [AuditLogController::class, 'index']);
        Route::get('/security/login-history', [AuditLogController::class, 'loginHistory']);
        Route::get('/security/risks', [RiskController::class, 'index']);
        Route::get('/security/tamper', [TamperController::class, 'index']);
        Route::post('/security/firewall', [FirewallController::class, 'store']);
        Route::post('/security/firewall/allowlist', [FirewallController::class, 'updateAllowlist']);
        Route::post('/security/fail2ban/unban', [Fail2banController::class, 'unban']);
        Route::post('/security/fail2ban/filters', [Fail2banController::class, 'storeFilter']);
        Route::post('/security/sshkeys', [SshKeyController::class, 'store']);
        Route::post('/security/clamav/scan', [ClamAvController::class, 'scan']);
        Route::post('/security/waf', [WafController::class, 'update']);
        Route::post('/security/waf/sites', [WafController::class, 'updateSite']);
        Route::post('/security/risks/fix', [RiskController::class, 'fix']);
        Route::post('/security/risks/ignore', [RiskController::class, 'ignore']);
        Route::post('/security/tamper/watches', [TamperController::class, 'storeWatch']);
        Route::delete('/security/tamper/watches/{watch}', [TamperController::class, 'destroyWatch']);
        Route::post('/security/tamper/baseline', [TamperController::class, 'baseline']);
        Route::post('/security/tamper/scan', [TamperController::class, 'scan']);
    });
});
