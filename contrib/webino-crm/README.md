# Webino CRM — Hosting, license meta, Git webhook (drop-in)

این پوشهٔ **`contrib/webino-crm`** برای مخزن **`Webino`** (`Plugins/Webino`) است؛ چون در بسیاری از محیط‌ها فقط `WebinoDashboard` باز است، فایل‌ها اینجا نگه‌داری می‌شوند تا با کپی به مسیر درست در CRM اعمال شوند.

## نصب سریع

1. محتوای `backend/Modules/Core/` را با حفظ namespace به ماژول Core در CRM اضافه/ادغام کنید (فایل‌های جدید + ویرایش‌های ذکرشده در `INTEGRATION.md`).
2. محتوای `backend/Modules/Accounting/Http/Controllers/WebinocrmLicenseCompatController.php` را جایگزین نسخهٔ موجود کنید (یا تفاوت‌ها را دستی اعمال کنید).
3. فایل migration را در `Modules/Core/Database/Migrations/` قرار دهید و `php artisan migrate` بزنید.
4. مسیرهای `Modules/Core/Routes/api.php` و `AccountingServiceProvider` را طبق `INTEGRATION.md` به‌روز کنید.
5. کامپوننت فرانت `HostingInfraPageView.tsx` را طبق `INTEGRATION.md` به داشبورد Next CRM وصل کنید.

**پیش‌نیاز:** `APP_KEY` برای castهای `encrypted` روی `core_hosting_secrets`.

## هماهنگی با WebinoDashboard

- پاسخ `POST /api/webinocrm/v1/license/check` پس از اعمال این بسته شامل `licensed_modules`, `vertical`, `module_git_repos` است.
- سینک لایسنس در داشبورد (`LicenseController::sync`) ماژول‌های `requires_license` را با لیست CRM هم‌تراز می‌کند و `dashboard_modules.git_repo` را از `module_git_repos` به‌روز می‌کند.
