---
sidebar_position: 21
---

# Terminal

Browser-based shell via xterm.js and agent WebSocket PTY. Optional Docker container attach (Phase D).

Permission: `system.manage`. UI: `/terminal` — also linked from **Apps** with `?container=name`.

## Ticket

| Method | Path | Body | Notes |
|--------|------|------|--------|
| `POST` | `/api/v1/terminal/ticket` | `{ container?: string }` | Returns `{ ticket, ws_path }` |

- **Host PTY:** omit `container` — full shell as agent user (allowlisted).
- **Container attach:** `container` must match `[a-zA-Z0-9][a-zA-Z0-9_.-]*` — runs `docker exec -it`.

## WebSocket

Connect to `/api/terminal/ws?ticket=<ticket>` from the panel origin.

- HMAC ticket expires quickly; single use.
- `CheckOrigin` enforced via `WEBINO_WS_ALLOWED_ORIGINS` (exact match, no localhost bypass in production).
- Resize events forwarded as JSON `{ type: "resize", cols, rows }`.

## Security

Terminal is high-privilege. Restrict to trusted operators; combine with IP allowlist middleware and enforced 2FA for admin roles. See [AGENT_SECURITY.md](../AGENT_SECURITY.md).
