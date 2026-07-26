---
sidebar_position: 10
---

# Email

Full mail stack: Postfix/Dovecot/Rspamd on the host, panel metadata in MariaDB, agent sync via `/v1/mail/*`.

Mutations require `permission:system.manage` unless noted. UI: **Email** section (9 pages) + **Webmail** embed.

## Domains

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/email/domains` | List mail domains |
| `POST` | `/api/v1/email/domains` | `{ domain, hosting_account_id? }` |
| `DELETE` | `/api/v1/email/domains/{domain}` | Remove domain |
| `PATCH` | `/api/v1/email/domains/{domain}/catchall` | `{ address }` catch-all target |

## Accounts

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/email/accounts` | List mailboxes + quota usage |
| `POST` | `/api/v1/email/accounts` | `{ address, password, quota_mb?, hosting_account_id? }` |
| `PATCH` | `/api/v1/email/accounts/{account}/password` | `{ password }` |
| `PATCH` | `/api/v1/email/accounts/{account}/quota` | `{ quota_mb }` via `doveadm quota set` |
| `DELETE` | `/api/v1/email/accounts/{account}` | Remove mailbox |

## Forwarders

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/email/forwarders` | List |
| `POST` | `/api/v1/email/forwarders` | `{ source, destination }` |
| `DELETE` | `/api/v1/email/forwarders/{forwarder}` | Remove |

## Autoresponders

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/email/autoresponders` | Sieve vacation rules |
| `POST` | `/api/v1/email/autoresponders` | `{ address, subject, body, active? }` |
| `DELETE` | `/api/v1/email/autoresponders/{autoresponder}` | Remove |

## Mailing lists

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/email/lists` | List lists |
| `POST` | `/api/v1/email/lists` | Create list |
| `PATCH` | `/api/v1/email/lists/{list}` | Update destinations / active |
| `POST` | `/api/v1/email/lists/{list}/members` | `{ address }` add member |
| `DELETE` | `/api/v1/email/lists/{list}/members` | `{ address }` remove member |
| `DELETE` | `/api/v1/email/lists/{list}` | Delete list |

## Mail authentication (SPF / DKIM / DMARC)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/email/domains/{domain}/auth/validate` | Live DNS validation |
| `POST` | `/api/v1/email/domains/{domain}/auth/generate` | Generate keys + push DNS records |

## Antispam (Rspamd)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/email/antispam` | Greylisting / antispam toggles |
| `POST` | `/api/v1/email/antispam` | Update settings |

## Mail queue

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/email/queue` | Queue listing (`system.manage`) |
| `POST` | `/api/v1/email/queue/flush` | Flush deferred queue |
| `DELETE` | `/api/v1/email/queue` | Delete selected messages |

## Webmail

Roundcube via embed ticket — see [Embed](./embed.md). UI: `/webmail`.

## Agent

Host operations: `/v1/mail/accounts`, `/v1/mail/domains`, `/v1/mail/forwarders`, `/v1/mail/auth`, `/v1/mail/queue`, bulk quota `GET /v1/mail/quota?addresses=`.

Reconcile: `panel:reconcile-host` compares panel rows with agent GET lists.
