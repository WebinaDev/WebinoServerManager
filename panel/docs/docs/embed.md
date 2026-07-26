---
sidebar_position: 15
---

# Embed (sidecar UIs)

Signed iframe tickets for internal Docker sidecars: phpMyAdmin, phpPgAdmin, Roundcube webmail.

## Ticket flow

1. Authenticated user with matching permission requests a ticket.
2. Panel returns a short-lived HMAC token.
3. Browser loads sidecar URL with ticket; sidecar verifies via panel.

## phpMyAdmin

| Method | Path | Permission |
|--------|------|------------|
| `POST` | `/api/v1/embeds/phpmyadmin/ticket` | `databases.manage` |
| `GET` | `/api/v1/embeds/phpmyadmin/verify` | Sidecar callback (no session) |

UI: `/phpmyadmin` — database selector pre-fills signon.

## phpPgAdmin

| Method | Path | Permission |
|--------|------|------------|
| `POST` | `/api/v1/embeds/phppgadmin/ticket` | `databases.manage` |
| `GET` | `/api/v1/embeds/phppgadmin/verify` | Sidecar callback |

UI: `/phppgadmin`.

## Webmail (Roundcube)

| Method | Path | Permission |
|--------|------|------------|
| `POST` | `/api/v1/embeds/webmail/ticket` | `system.manage` |
| `GET` | `/api/v1/embeds/webmail/verify` | Sidecar callback |

UI: `/webmail` — autologon plugin maps ticket to mailbox session.

## Security

`EmbedAccessPolicy` scopes tickets to the requesting user's hosting resources (IDOR fix, Phase 23). Sidecars run on internal Docker network only.
