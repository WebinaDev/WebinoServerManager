---
sidebar_position: 17
---

# Webhooks

HMAC-signed outbound webhooks for domain events. Endpoints stored in panel DB; delivery async via queue.

Permission: `webhooks.manage`. UI: `/webhooks`.

## Endpoints

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/webhooks` | List endpoints |
| `POST` | `/api/v1/webhooks` | `{ url, events[], secret?, enabled? }` |
| `PATCH` | `/api/v1/webhooks/{endpoint}` | Update URL, events, secret |
| `DELETE` | `/api/v1/webhooks/{endpoint}` | Remove |
| `POST` | `/api/v1/webhooks/{endpoint}/test` | Send test payload |

## Deliveries

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/webhooks/deliveries` | Paginated delivery log (status, response code) |

## Events

| Event | Trigger |
|-------|---------|
| `backup.completed` | Backup job finished |
| `ssl.expiring` | Certificate within alert window |
| `alert.fired` | Metric or hosting quota alert |
| `user.created` | New panel user |

## Security

- URLs validated with `SafeWebhookUrl` — HTTPS required in production; private/metadata IPs blocked (SSRF guard).
- Signature header: `X-Webino-Signature` (HMAC-SHA256 of body with endpoint secret).
