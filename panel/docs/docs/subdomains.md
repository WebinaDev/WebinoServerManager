---
sidebar_position: 7
---

# Subdomains

Subdomains are stored in `hosting_subdomains` and provisioned on the agent via `POST /v1/subdomains`. Each subdomain gets its own nginx vhost with optional PHP-FPM pool, SSL, force-HTTPS, and HSTS.

## Endpoints

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| `GET` | `/api/v1/subdomains` | `auth` | Returns `{ subdomains }` ordered by FQDN |
| `POST` | `/api/v1/subdomains` | `domains.manage` | Create subdomain; calls agent; quota check if `hosting_account_id` set |
| `PATCH` | `/api/v1/subdomains/{id}` | `domains.manage` | Update config; re-provisions agent vhost (`action: create`) |
| `DELETE` | `/api/v1/subdomains/{id}` | `domains.manage` | Calls agent `action: delete` then removes panel row |

## Request bodies

### POST `/api/v1/subdomains`

```json
{
  "parent_domain": "example.com",
  "subdomain": "api",
  "document_root": "sites/api.example.com/public",
  "php_pool": "php83",
  "ssl_enabled": true,
  "force_https": true,
  "hsts": true,
  "hosting_account_id": 1
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `parent_domain` | string | yes | Must be a registered domain; max 253 chars |
| `subdomain` | string | yes | Label only (e.g. `api`); alphanumeric + hyphens |
| `document_root` | string | no | Defaults to `sites/{fqdn}/public` |
| `php_pool` | string | no | FPM pool name (see PHP pools) |
| `ssl_enabled` | boolean | no | Enables SSL on the vhost |
| `force_https` | boolean | no | Adds HTTP→HTTPS redirect |
| `hsts` | boolean | no | Adds `Strict-Transport-Security` header |
| `hosting_account_id` | integer | no | Triggers quota check against plan `max_subdomains` |

### PATCH `/api/v1/subdomains/{id}`

Same optional fields as POST (except `parent_domain`, `subdomain`). The agent vhost is fully re-written (`action: create`) with the updated configuration.

## Agent payload

Both create and update send `action: create` to `POST /v1/subdomains`:

```json
{
  "action": "create",
  "fqdn": "api.example.com",
  "parent_domain": "example.com",
  "subdomain": "api",
  "document_root": "sites/api.example.com/public",
  "php_pool": "php83",
  "ssl": true,
  "force_https": true,
  "hsts": true
}
```

Delete sends `action: delete` with `fqdn` and `document_root`.

## HSTS migration

Migration `2026_07_16_000030_subdomain_hsts` adds the `hsts` boolean column (default `false`) to `hosting_subdomains` if it does not already exist.

## Quota enforcement

When `hosting_account_id` is provided, `HostingQuota::assert($account, 'subdomains')` checks the count of rows in `hosting_subdomains` where `hosting_account_id = $account->id` against the plan's `max_subdomains` limit. Returns HTTP 422 on breach.

## UI (Subdomains page)

- **Create form** — parent domain select, subdomain label, document root, PHP pool, hosting account select, SSL/force-HTTPS/HSTS checkboxes.
- **List** — FQDN, document root, pool, SSL/HTTPS/HSTS badges, status, edit and delete buttons.
- **Edit dialog** — update document root, PHP pool, hosting account, ssl/force_https/hsts toggles; triggers agent re-provision.
