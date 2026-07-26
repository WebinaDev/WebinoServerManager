---
sidebar_position: 13
---

# SSL

Certificate lifecycle: Let's Encrypt HTTP/DNS-01, wildcard, custom upload, auto-renew, service binding.

Mutations require `permission:system.manage`. UI: `/ssl`.

## Certificates

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/ssl/certificates` | Panel rows + reconcile from agent |
| `POST` | `/api/v1/ssl/certificates` | Issue HTTP-01 cert `{ domain, alt_names? }` |
| `POST` | `/api/v1/ssl/certificates/wildcard` | DNS-01 wildcard via certbot hooks |
| `POST` | `/api/v1/ssl/certificates/upload` | Custom PEM upload |
| `POST` | `/api/v1/ssl/validate-chain` | `{ cert, chain? }` openssl verify preview |
| `POST` | `/api/v1/ssl/certificates/{certificate}/renew` | Manual renew |
| `POST` | `/api/v1/ssl/certificates/{certificate}/bind` | `{ service: panel\|mail }` |
| `PATCH` | `/api/v1/ssl/certificates/{certificate}` | Auto-renew / alert toggles |
| `DELETE` | `/api/v1/ssl/certificates/{certificate}` | Revoke + remove |

## Schedulers

- `panel:renew-ssl` — daily auto-renew for flagged certs
- `panel:check-ssl-expiry` — daily email alerts

## DNS-01 integration

Wildcard and provider challenges use `/v1/dns/providers/cloudflare/dns01` or AliDNS adapter. Local pdns uses `pdnsutil` TXT hooks in agent.

## Agent

`/v1/ssl/certificates` — issue, renew, revoke, upload, bind, validate chain. Reconcile syncs `expires_at` / `issuer`.
