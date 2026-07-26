---
sidebar_position: 12
---

# DNS

PowerDNS-backed local zones plus external provider adapters (Cloudflare, AliDNS). Panel stores zones/records; agent executes on host.

Mutations require `permission:system.manage`. UI: `/dns`.

## Local zones

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/dns/zones` | List zones |
| `POST` | `/api/v1/dns/zones` | `{ name, kind?: native\|master }` |
| `DELETE` | `/api/v1/dns/zones/{zone}` | Drop zone |
| `GET` | `/api/v1/dns/zones/{zone}/records` | Live record list from agent |
| `POST` | `/api/v1/dns/records` | Create record (typed forms) |
| `PATCH` | `/api/v1/dns/records/{record}` | Update in place |
| `DELETE` | `/api/v1/dns/records/{record}` | Remove |

## Advanced zone ops

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/dns/templates` | Zone template library |
| `POST` | `/api/v1/dns/zones/{zone}/template` | Apply template |
| `POST` | `/api/v1/dns/zones/slave` | Add secondary zone |
| `POST` | `/api/v1/dns/zones/{zone}/dnssec` | Enable DNSSEC |
| `DELETE` | `/api/v1/dns/zones/{zone}/dnssec` | Disable DNSSEC |
| `GET` | `/api/v1/dns/zones/{zone}/export` | BIND zone export |
| `POST` | `/api/v1/dns/zones/{zone}/import` | BIND zone import |

## Cloudflare provider

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/dns/providers/cloudflare` | Stored credentials (redacted) |
| `PATCH` | `/api/v1/dns/providers/cloudflare` | `{ api_token, zone_id?, enabled? }` |
| `POST` | `/api/v1/dns/providers/cloudflare/sync` | Push site records |
| `POST` | `/api/v1/dns/providers/cloudflare/dns01` | DNS-01 challenge helper for SSL |

## AliDNS provider (Phase D)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/dns/providers/alidns` | Stored credentials (redacted) |
| `PATCH` | `/api/v1/dns/providers/alidns` | `{ api_token, zone_id?, enabled? }` |

Agent: `/v1/dns/providers/cloudflare`, `/v1/dns/providers/alidns` (configure, sync_records, dns01).

## Agent (local)

`/v1/dns/zones`, `/v1/dns/records`, DNSSEC, slaves, templates, import/export. Reconcile compares per-zone record counts.
