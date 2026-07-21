---
sidebar_position: 6
---

# Domains

Primary domains are stored in the panel database (`hosting_domains`) and provisioned on the agent via `POST /v1/domains`. The index endpoint merges panel rows with the live agent registry to surface drift.

## Endpoints

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| `GET` | `/api/v1/domains` | `auth` | Returns `{ domains, sites }` — panel rows + agent registry |
| `POST` | `/api/v1/domains` | `domains.manage` | Create domain; calls agent; quota check if `hosting_account_id` set |
| `PATCH` | `/api/v1/domains/{id}` | `domains.manage` | Update aliases, slug, hosting account (panel only) |
| `DELETE` | `/api/v1/domains/{id}` | `domains.manage` | Deletes agent site via `webina site delete` then removes panel row |

## Request bodies

### POST `/api/v1/domains`

```json
{
  "domain": "example.com",
  "slug": "example",
  "aliases": "www.example.com example.net",
  "hosting_account_id": 1
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `domain` | string | yes | Lowercased; max 253 chars |
| `slug` | string | no | Site slug for agent; defaults to first label of domain |
| `aliases` | string | no | Space or comma-separated alias names |
| `hosting_account_id` | integer | no | Must exist in `hosting_accounts`; triggers quota check |

### PATCH `/api/v1/domains/{id}`

```json
{
  "aliases": "www.example.com",
  "slug": "example",
  "hosting_account_id": 2
}
```

All fields are optional. Panel DB only — does not re-provision the agent vhost.

## Drift detection

`GET /api/v1/domains` returns both `domains` (panel rows) and `sites` (agent registry from `GET /v1/domains`). The UI compares the two by `domain`/`name` and surfaces agent sites not yet tracked in the panel, allowing one-click import.

## Quota enforcement

When `hosting_account_id` is provided on create, `HostingQuota::assert($account, 'domains')` is called. It counts `hosting_domains` rows where `hosting_account_id = $account->id` and rejects with HTTP 422 if the plan's `max_domains` limit is reached.

## UI (Domains page)

- **Create form** — domain, slug, aliases, hosting account select.
- **Table** — domain, aliases, hosting account, status, edit/delete actions.
- **Edit dialog** — update aliases and hosting account link.
- **Registry card** — lists agent sites not present in the panel with a one-click add button.
