# Data plane (Wave 10)

Wave 10 extends FTP, Databases, DNS providers, and Cron typed tasks.

## FTP

- Panel DB: `ftp_accounts.quota_mb`, `ftp_accounts.enabled`
- API: `GET /api/v1/ftp/service`, `PATCH /api/v1/ftp/accounts/{id}/quota`, `PATCH .../enabled`
- Agent: `/v1/ftp/accounts` actions `set_quota`, `enable`, `disable`; `/v1/ftp/service` passive/log notes

## Databases

- Soft-delete recycle bin on `hosting_databases.deleted_at`
- Tools: repair, optimize, storage engine, encrypted MySQL root password in `panel_settings`
- Redis engine (**Have**): panel tracks + agent `redis_info` / `redis-cli` probe
- API: `/api/v1/databases/recycle`, `/repair`, `/optimize`, `/engine`, `/root-password`, `GET .../databases/{id}/size`

## DNS Cloudflare

- Table: `dns_providers` (token encrypted)
- API: `GET/PATCH /api/v1/dns/providers/cloudflare`, `POST .../sync`, `POST .../dns01`
- Agent: `/v1/dns/providers/cloudflare`

## DNS AliDNS

- Same `dns_providers` row with `provider=alidns`
- Token format: `AccessKeyId:AccessKeySecret` (or `|`)
- API: `GET/PATCH /api/v1/dns/providers/alidns`, `POST .../sync`, `POST .../dns01`
- Agent: `/v1/dns/providers/alidns` — signed Aliyun Alidns OpenAPI (`AddDomainRecord` / `UpdateDomainRecord`)

## Cron typed tasks

- Columns: `cron_jobs.task_type`, `task_config`, `notify_on_failure`
- Allowlisted scripts: `config/cron_scripts.php` → `/usr/local/lib/webino/cron-*`
- Failure notify: `panel:check-cron-failures` → `NotificationDispatcher`
- API: `GET /api/v1/cron/scripts`

Permissions: mutations require `system.manage` (FTP/DNS/Cron) or `databases.manage` (DB).
