# ادغام دستی در مخزن Webino (`Plugins/Webino`)

## فایل‌های جدید (کپی به مسیر مقصد)

| منبع در contrib | مقصد در CRM |
|-----------------|-------------|
| `backend/Modules/Core/Services/CoreLicenseMetaNormalizer.php` | `backend/Modules/Core/Services/` |
| `backend/Modules/Core/Services/InfraAuditLogger.php` | `backend/Modules/Core/Services/` |
| `backend/Modules/Core/Entities/CoreHostingSecret.php` | `backend/Modules/Core/Entities/` |
| `backend/Modules/Core/Entities/CoreModuleGitSource.php` | `backend/Modules/Core/Entities/` |
| `backend/Modules/Core/Entities/CoreInfraAuditLog.php` | `backend/Modules/Core/Entities/` |
| `backend/Modules/Core/Database/Migrations/2026_05_10_200000_core_hosting_infra_tables.php` | `backend/Modules/Core/Database/Migrations/` |
| `backend/Modules/Core/Http/Controllers/HostingSettingsController.php` | `backend/Modules/Core/Http/Controllers/` |
| `backend/Modules/Core/Http/Controllers/HostingOpsController.php` | `backend/Modules/Core/Http/Controllers/` |
| `backend/Modules/Core/Http/Controllers/GitInboundWebhookController.php` | `backend/Modules/Core/Http/Controllers/` |

## جایگزینی کامل

- `backend/Modules/Accounting/Http/Controllers/WebinocrmLicenseCompatController.php` ← نسخهٔ داخل `contrib/webino-crm/backend/Modules/Accounting/Http/Controllers/`
- `backend/Modules/Core/Http/Controllers/LicenseParityController.php` ← نسخهٔ داخل `contrib/webino-crm/backend/Modules/Core/Http/Controllers/LicenseParityController.php`

## `Modules/Accounting/Providers/AccountingServiceProvider.php`

در closure اول `api/webinocrm/v1` (middleware فقط `api`) این خط را اضافه کنید:

```php
Route::post('/git/webhook', [\Modules\Core\Http\Controllers\GitInboundWebhookController::class, 'handle']);
```

## `Modules/Core/Routes/api.php`

پس از مسیرهای licenses:

```php
Route::get('/hosting/settings', [\Modules\Core\Http\Controllers\HostingSettingsController::class, 'show'])->middleware('auth:sanctum');
Route::put('/hosting/settings', [\Modules\Core\Http\Controllers\HostingSettingsController::class, 'update'])->middleware('auth:sanctum');

Route::get('/hosting/ops/stacks', [\Modules\Core\Http\Controllers\HostingOpsController::class, 'stacks'])->middleware('auth:sanctum');
Route::get('/hosting/ops/endpoints', [\Modules\Core\Http\Controllers\HostingOpsController::class, 'endpoints'])->middleware('auth:sanctum');
```

هر دو کنترلر داخلاً نقش `system_manager` را بررسی می‌کنند.

## فرانت Next (`Plugins/Webino/frontend`)

1. فایل `frontend/components/dashboard/pages/HostingInfraPageView.tsx` را از contrib کپی کنید.
2. در `dashboard-registry.tsx` یک ورودی اضافه کنید، مثلاً `hosting_infra: <HostingInfraPageView />`.
3. در `dashboard-routes.ts`:

```ts
hosting_infra: { titleFa: 'میزبانی و زیرساخت', titleEn: 'Hosting & infra', group: 'core', apiHint: '/v1/core/hosting/settings' },
```

4. فقط کاربران با نقش `system_manager` باید این منو را ببینند (الگوی سایر صفحات ادمین).

## تنظیمات اولیه (SystemSetting گروه `hosting`)

کلیدهای پیشنهادی (از UI Hosting یا `PUT /api/v1/core/settings` با group=`hosting`):

- `public_crm_url` — آدرس عمومی CRM
- `portainer_url` — مثلاً `https://portainer.example.com` (بدون اسلش انتها)
- `git_server_public_url` — آدرس نمایشی Gitea/GitLab

اسرار در جدول `core_hosting_secrets` از طریق `PUT /api/v1/core/hosting/settings` ذخیره می‌شوند.

## وب‌هوک Git

`POST /api/webinocrm/v1/git/webhook`

هدر: `X-Webhook-Secret: <همان git_webhook_secret ذخیره‌شده>`

بدنهٔ JSON ساده:

```json
{ "module_slug": "accounting", "repo_url": "https://git.example.com/org/accounting.git" }
```

پس از تأیید، `core_module_git_sources` به‌روز می‌شود (منبع حقیقت مرکزی برای repo ماژول‌ها در CRM).
