---
sidebar_position: 3
---

# Hosting

Plans, accounts, quota, suspend/unsuspend, and host provisioning via the Go agent.

**Reseller hierarchy is out of scope** (won't-fix for this ecosystem).

## Plans

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/hosting/plans` | List |
| `POST` | `/api/v1/hosting/plans` | Create (includes `max_apps`, `bandwidth_mb`, …) |
| `PATCH` | `/api/v1/hosting/plans/{id}` | Update |
| `DELETE` | `/api/v1/hosting/plans/{id}` | Blocked if accounts exist |

## Accounts

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/hosting/accounts` | With plan + owner |
| `POST` | `/api/v1/hosting/accounts` | Agent `POST /v1/hosting/provision` then DB row |
| `PATCH` | `/api/v1/hosting/accounts/{id}` | plan / owner / primary domain |
| `DELETE` | `/api/v1/hosting/accounts/{id}` | Agent `POST /v1/hosting/deprovision` then DB delete |
| `POST` | `…/suspend` · `…/unsuspend` | Agent suspend (nginx/FTP/cron + mail lock marker) |
| `GET` | `…/usage` | Quota summary (disk, inodes, bandwidth, resource counts) |

Hourly `panel:collect-hosting-usage` pulls disk/inodes/bandwidth from the agent.

## Quota

`HostingQuota::assert` is enforced when creating Domains / Subdomains (and other resources) with `hosting_account_id`. Per-account quota alerts notify via Monitoring channels.

## Agent endpoints

- `/v1/hosting/provision` — unix user + home + `public_html`
- `/v1/hosting/deprovision` — suspend cleanup + `userdel`
- `/v1/hosting/suspend` · `/unsuspend` · `/usage`
