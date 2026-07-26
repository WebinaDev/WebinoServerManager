# Support (internal tickets)

The **Support** page in WebinoServerManager is for **internal panel tickets only**. It tracks issues and requests among panel operators and hosting staff.

There is **no integration** with external helpdesk products (Zendesk, Freshdesk, etc.). Do not expose this UI to end customers unless you build your own workflow on top of the internal API.

## Features

- Create tickets with priority (`low` / `normal` / `high` / `urgent`)
- Filter list by `status` and `priority`
- Reply while open; **close** and **reopen**
- Stored in panel MariaDB (`support_tickets`, `support_ticket_replies`) — not synced off-host

## API

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/support/tickets` | Optional `?status=&priority=` |
| `POST` | `/api/v1/support/tickets` | Create (`system.manage`) |
| `GET` | `/api/v1/support/tickets/{id}` | Detail + replies |
| `POST` | `/api/v1/support/tickets/{id}/replies` | Reply |
| `POST` | `/api/v1/support/tickets/{id}/close` | Close |
| `POST` | `/api/v1/support/tickets/{id}/reopen` | Reopen closed ticket |

UI: `/support`
